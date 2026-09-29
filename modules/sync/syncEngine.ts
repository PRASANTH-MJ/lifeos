import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { firestore } from '@/firebase/config';
import { cursorQueryFloor, syncConfigFor, SYNC_TABLES } from './syncSchema';

/** Every value that ever flows through this file is whatever SQLite itself stores (string,
 * number, null, boolean) or the JSON round-trip of one via Firestore — never anything more
 * exotic — so this cast just satisfies expo-sqlite's bind-param typing, not a real type hole. */
function bindValue(value: unknown): SQLiteBindValue {
  return value as SQLiteBindValue;
}

type SyncRecord = {
  table: string;
  syncId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted: boolean;
};

/** Set once by useSyncEngine() (mounted at the root) whenever auth state changes — every other
 * function in this file reads it instead of taking a uid parameter, so the ~30 call sites across
 * every module's hooks don't each need their own useAuth() just to know who's signed in. */
let currentUid: string | null = null;
export function setSyncUid(uid: string | null): void {
  currentUid = uid;
}

/** Set alongside currentUid by useSyncEngine() whenever the cached entitlement changes — enqueue()
 * reads it to decide whether a just-written row should also be pushed to Firestore immediately
 * (premium: real-time) or left for the next gated flushOutbox run (free: daily/weekly batch). */
let currentPremium = false;
export function setSyncPremium(premium: boolean): void {
  currentPremium = premium;
}

function recordDocId(table: string, syncId: string): string {
  return `${table}__${syncId}`;
}

function recordsCollection(uid: string) {
  return collection(firestore, 'users', uid, 'records');
}

/** This SDK (the web `firebase/firestore` package) has no persistent offline cache available on
 * React Native — there's no IndexedDB for `persistentLocalCache` to fall back to, so without this
 * cursor every cold start would re-read a user's entire synced history from scratch (every
 * existing document counts as an "added" docChange on a brand-new listener). Persisting the
 * highest `updatedAt` seen so far and filtering on it instead lets a cold start only re-fetch what
 * actually changed since this device's last successful sync. */
function syncCursorKey(uid: string): string {
  return `flowsy-sync-cursor-${uid}`;
}

async function getSyncCursor(uid: string): Promise<string | null> {
  return AsyncStorage.getItem(syncCursorKey(uid));
}

/** Only ever moves forward — a listener error or an out-of-order batch must never regress the
 * cursor and cause previously-seen documents to be skipped on the next cold start. */
async function advanceSyncCursor(uid: string, candidate: string): Promise<void> {
  const current = await AsyncStorage.getItem(syncCursorKey(uid));
  if (!current || candidate > current) {
    await AsyncStorage.setItem(syncCursorKey(uid), candidate);
  }
}

/** Product decision: premium users get a daily sync cadence, free users weekly — see syncIfDue. */
const SYNC_INTERVAL_MS = {
  daily: 24 * 60 * 60 * 1000,
};

function lastSyncAtKey(uid: string): string {
  return `flowsy-sync-last-run-${uid}`;
}

async function getLastSyncAt(uid: string): Promise<number> {
  const raw = await AsyncStorage.getItem(lastSyncAtKey(uid));
  return raw ? Number(raw) : 0;
}

/** Exposed for UI use — a manual "Sync now" action and a "last synced" status line. Returns null
 * rather than 0 for "never synced" so callers don't need to know the internal sentinel value. */
export async function getLastSyncedAt(uid: string): Promise<number | null> {
  const ms = await getLastSyncAt(uid);
  return ms > 0 ? ms : null;
}

async function resolveForeignKeysOutgoing(
  db: SQLiteDatabase,
  table: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const config = syncConfigFor(table);
  if (!config?.foreignKeys) return data;
  const resolved = { ...data };
  for (const fk of config.foreignKeys) {
    const localId = data[fk.column];
    if (localId == null) continue;
    const parent = await db.getFirstAsync<{ sync_id: string | null }>(
      `SELECT sync_id FROM ${fk.referencesTable} WHERE id = ?`,
      [localId as number]
    );
    resolved[fk.column] = parent?.sync_id ?? null;
  }
  return resolved;
}

async function pushToFirestore(record: SyncRecord): Promise<void> {
  if (!currentUid) return;
  await setDoc(doc(recordsCollection(currentUid), recordDocId(record.table, record.syncId)), record, { merge: true });
}

/** Fired whenever sync_outbox's pending count could have changed (enqueue, an immediate push's
 * dequeue, or flushOutbox) or a sync run's lastSyncedAt advances — powers useSyncStatus's live
 * pending-count/last-synced indicator without a second polling loop of its own; same
 * subscribe-listener idiom as onSyncMerge further down this file. */
type SyncStatusListener = () => void;
const syncStatusListeners = new Set<SyncStatusListener>();

export function onSyncStatusChange(listener: SyncStatusListener): () => void {
  syncStatusListeners.add(listener);
  return () => syncStatusListeners.delete(listener);
}

function notifySyncStatusChange(): void {
  for (const listener of syncStatusListeners) listener();
}

/** Fired synchronously whenever a local write (insert/update/delete) lands for a given table —
 * BEFORE any Firestore push is attempted, so it's available offline and regardless of plan tier
 * (unlike onSyncMerge, which only ever fires from a REMOTE change coming back down). Most read
 * hooks (useCardioLogs, useHabits, ...) pick up a same-screen write immediately because they call
 * refresh() themselves right after their own insert/update — this is for the other case: a
 * *different* hook instance of the same table (e.g. usePublicProfileStatsSync's own independent
 * useCardioLogs() call, mounted once at the root layout and — unlike a routed screen — never
 * "focused" again by navigation) that needs to notice a write made through someone else's
 * instance. Same subscribe-listener idiom as onSyncMerge/onSyncStatusChange. */
type LocalWriteListener = (table: string) => void;
const localWriteListeners = new Set<LocalWriteListener>();

export function onLocalWrite(listener: LocalWriteListener): () => void {
  localWriteListeners.add(listener);
  return () => localWriteListeners.delete(listener);
}

function notifyLocalWrite(table: string): void {
  for (const listener of localWriteListeners) listener(table);
}

/** Every local write lands here instantly. For a free-plan user, pushing it to Firestore doesn't
 * happen here — that's left for the gated cadence in syncIfDue (weekly). For a premium user, this
 * ALSO kicks off a push to Firestore right away (best-effort, fire-and-forget — see below) so
 * premium's "real-time cloud sync" doesn't wait on the once-a-day batch either.
 *
 * The row is queued into sync_outbox regardless of plan, before the immediate-push attempt: if
 * that attempt fails (offline, transient error), the row is still safely queued for the next
 * flushOutbox run to retry, so a premium user never silently loses a pending write just because
 * their immediate push happened to fail. Only the latest queued state per row is kept: since a
 * Firestore push always writes the row's *current* full state (not a diff), an earlier queued
 * write for the same table+syncId is now strictly superseded once a newer one is enqueued.
 *
 * The immediate push is deliberately NOT awaited here: every insert/update/delete path in the app
 * awaits pushLocalRow/recordDeleteBeforeRemoving (which call this), and local writes have always
 * been instant regardless of plan — awaiting a network round-trip here would make something as
 * routine as toggling a habit noticeably slower for premium users specifically, the opposite of
 * what "real-time sync" is supposed to feel like. */
async function enqueue(db: SQLiteDatabase, record: SyncRecord): Promise<void> {
  const payload = JSON.stringify(record);
  await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND sync_id = ?', [record.table, record.syncId]);
  const result = await db.runAsync('INSERT INTO sync_outbox (table_name, sync_id, payload, created_at) VALUES (?, ?, ?, ?)', [
    record.table,
    record.syncId,
    payload,
    new Date().toISOString(),
  ]);
  notifySyncStatusChange();
  notifyLocalWrite(record.table);

  if (currentPremium && currentUid) {
    pushToFirestore(record)
      .then(() => db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [result.lastInsertRowId]))
      .then(() => notifySyncStatusChange())
      .catch(() => {
        // Left queued — the next due (or realtime-listener-triggered) flush retries it.
      });
  }
}

/** Call after every local insert/update, once the row has its final id/sync_id/updated_at
 * committed — re-reads the row and pushes its current state. One function covers both insert and
 * update, since it doesn't care what changed, only what the row looks like now.
 *
 * Looks up by `rowid`, not a named `id` column: for every table with `id INTEGER PRIMARY KEY`,
 * SQLite makes that column a direct alias of rowid, so this is identical to `WHERE id = ?` for
 * them — but it also transparently covers finance_transaction_labels, whose PRIMARY KEY is the
 * compound (transaction_id, label_id) and has no `id` column at all. `localId` for that table is
 * just the `lastInsertRowId` a plain INSERT already returns, same as any other table. */
export async function pushLocalRow(db: SQLiteDatabase, table: string, localId: number): Promise<void> {
  const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE rowid = ?`, [localId]);
  if (!row || !row.sync_id) return;
  const { id, sync_id, updated_at, ...rest } = row;
  const data = await resolveForeignKeysOutgoing(db, table, rest);
  await enqueue(db, { table, syncId: sync_id as string, data, updatedAt: (updated_at as string) ?? new Date().toISOString(), deleted: false });
}

/** Call before removing a row locally — records a tombstone (so a remote listener can tell
 * "deleted" apart from "never existed") and pushes the deletion marker. Looks up by `rowid` —
 * see pushLocalRow's doc comment for why. */
export async function recordDeleteBeforeRemoving(db: SQLiteDatabase, table: string, localId: number): Promise<void> {
  const row = await db.getFirstAsync<{ sync_id: string | null }>(`SELECT sync_id FROM ${table} WHERE rowid = ?`, [localId]);
  if (!row?.sync_id) return;
  const now = new Date().toISOString();
  await db.runAsync('INSERT OR REPLACE INTO sync_tombstones (sync_id, table_name, deleted_at) VALUES (?, ?, ?)', [
    row.sync_id,
    table,
    now,
  ]);
  await enqueue(db, { table, syncId: row.sync_id, data: {}, updatedAt: now, deleted: true });
}

/** Pushes every queued local write to Firestore. Called only from syncIfDue's gated cadence now —
 * not on every write or every foreground — so a run here may be flushing hours' or days' worth of
 * accumulated edits at once, not a single fresh one. */
async function flushOutbox(db: SQLiteDatabase): Promise<void> {
  if (!currentUid) return;
  const rows = await db.getAllAsync<{ id: number; payload: string }>('SELECT id, payload FROM sync_outbox ORDER BY id ASC');
  for (const row of rows) {
    try {
      await pushToFirestore(JSON.parse(row.payload) as SyncRecord);
      await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [row.id]);
    } catch {
      // Leave it — the next due sync retries.
    }
  }
  if (rows.length > 0) notifySyncStatusChange();
}

/** Fired when a remote merge is about to overwrite a local edit made within the last
 * RECENT_LOCAL_EDIT_MS — the one case where the merge's ordinary silent last-write-wins is likely
 * to actually confuse a user (their own just-made edit vanishing with no explanation), as opposed
 * to the vast majority of merges, which are a device catching up on old changes no one is
 * currently looking at. Not raised for brand-new inserts (nothing local to have just edited) or
 * deletes (already have their own tombstone bookkeeping). */
type LocalEditOverwrittenListener = (info: { table: string; syncId: string }) => void;
const localEditOverwrittenListeners = new Set<LocalEditOverwrittenListener>();

export function onLocalEditOverwritten(listener: LocalEditOverwrittenListener): () => void {
  localEditOverwrittenListeners.add(listener);
  return () => localEditOverwrittenListeners.delete(listener);
}

const RECENT_LOCAL_EDIT_MS = 60_000;

class ParentNotFoundError extends Error {}

/** A remote record's `data` keys become raw column names spliced into `UPDATE`/`INSERT` SQL
 * below (only the *values* are bound params) — since a record's owner controls their own
 * Firestore doc content directly (firestore.rules only checks `request.auth.uid == uid`, not
 * document shape), a crafted `data` key like `"x = 1 --"` would otherwise let a user inject SQL
 * against their own local database. Caching each table's real column names via PRAGMA table_info
 * and filtering `resolved` down to only those keys closes this off — any key that isn't a real
 * column is silently dropped rather than ever reaching a template string. */
const tableColumnsCache = new Map<string, Set<string>>();
async function getTableColumns(db: SQLiteDatabase, table: string): Promise<Set<string>> {
  const cached = tableColumnsCache.get(table);
  if (cached) return cached;
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const columns = new Set(rows.map((r) => r.name));
  tableColumnsCache.set(table, columns);
  return columns;
}

/** Applies one remote record to local SQLite. Throws ParentNotFoundError if a foreign key can't
 * be resolved yet (the referenced row hasn't synced down in this batch) — the caller retries
 * those once after the rest of the batch has landed, which covers both ordinary cross-table
 * ordering and same-table self-references (e.g. a subtask's parent_task_id). */
async function mergeRemoteRecord(db: SQLiteDatabase, record: SyncRecord): Promise<void> {
  const { table, syncId, data, updatedAt, deleted } = record;
  if (!syncConfigFor(table)) return;

  if (deleted) {
    await db.runAsync(`DELETE FROM ${table} WHERE sync_id = ?`, [syncId]);
    await db.runAsync('INSERT OR REPLACE INTO sync_tombstones (sync_id, table_name, deleted_at) VALUES (?, ?, ?)', [
      syncId,
      table,
      updatedAt,
    ]);
    return;
  }

  const tombstoned = await db.getFirstAsync('SELECT 1 FROM sync_tombstones WHERE sync_id = ?', [syncId]);
  if (tombstoned) return;

  const config = syncConfigFor(table);
  const resolved: Record<string, unknown> = { ...data };
  for (const fk of config?.foreignKeys ?? []) {
    const remoteRef = data[fk.column];
    if (remoteRef == null) {
      resolved[fk.column] = null;
      continue;
    }
    const parent = await db.getFirstAsync<{ id: number }>(`SELECT id FROM ${fk.referencesTable} WHERE sync_id = ?`, [
      bindValue(remoteRef),
    ]);
    if (!parent) throw new ParentNotFoundError();
    resolved[fk.column] = parent.id;
  }

  const validColumns = await getTableColumns(db, table);
  for (const key of Object.keys(resolved)) {
    if (!validColumns.has(key)) delete resolved[key];
  }

  // `rowid AS id` — see pushLocalRow's doc comment; covers finance_transaction_labels, whose
  // compound PRIMARY KEY means it has no real `id` column, the same way as every other table.
  const existing = await db.getFirstAsync<{ id: number; updated_at: string | null }>(
    `SELECT rowid AS id, updated_at FROM ${table} WHERE sync_id = ?`,
    [syncId]
  );

  if (existing) {
    if (existing.updated_at && existing.updated_at >= updatedAt) return; // local already same-or-newer (last-write-wins)
    if (existing.updated_at && Date.now() - Date.parse(existing.updated_at) < RECENT_LOCAL_EDIT_MS) {
      console.warn(`[sync] local edit to ${table}/${syncId} made in the last ${RECENT_LOCAL_EDIT_MS / 1000}s was overwritten by a newer remote change`);
      for (const listener of localEditOverwrittenListeners) listener({ table, syncId });
    }
    const columns = Object.keys(resolved);
    if (columns.length === 0) return;
    const setClause = columns.map((column) => `${column} = ?`).join(', ');
    await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE rowid = ?`, [
      ...columns.map((c) => bindValue(resolved[c])),
      existing.id,
    ]);
  } else {
    const columns = [...Object.keys(resolved), 'sync_id'];
    const placeholders = columns.map(() => '?').join(', ');
    await db.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, [
      ...Object.keys(resolved).map((c) => bindValue(resolved[c])),
      syncId,
    ]);
  }
}

/** Most screens pick up a remote merge naturally via useFocusEffect the next time they're
 * navigated to. That doesn't work for a table read once at the root layout and never revisited
 * through navigation (e.g. an onboarding-complete flag gating which screen even renders) — those
 * consumers subscribe here instead of polling. */
type MergeListener = (tables: ReadonlySet<string>) => void;
const mergeListeners = new Set<MergeListener>();

export function onSyncMerge(listener: MergeListener): () => void {
  mergeListeners.add(listener);
  return () => mergeListeners.delete(listener);
}

async function mergeBatch(db: SQLiteDatabase, records: SyncRecord[]): Promise<void> {
  const order = SYNC_TABLES.map((config) => config.table);
  const byTable = new Map<string, SyncRecord[]>();
  for (const record of records) {
    byTable.set(record.table, [...(byTable.get(record.table) ?? []), record]);
  }

  for (const table of order) {
    const tableRecords = byTable.get(table);
    if (!tableRecords) continue;
    const deferred: SyncRecord[] = [];
    for (const record of tableRecords) {
      try {
        await mergeRemoteRecord(db, record);
      } catch (error) {
        if (error instanceof ParentNotFoundError) deferred.push(record);
      }
    }
    // One retry pass — covers self-references (e.g. a subtask arriving before its parent task
    // within the same table's batch); a parent from a still-later table can't be helped by this,
    // but SYNC_TABLES' dependency ordering means that shouldn't happen in practice.
    for (const record of deferred) {
      await mergeRemoteRecord(db, record).catch(() => {});
    }
  }

  const touchedTables = new Set(byTable.keys());
  for (const listener of mergeListeners) listener(touchedTables);
}

/** The full push+pull sync cycle — mounted at the root (see app/_layout.tsx) and called
 * opportunistically (on mount, app foreground, network reconnect). It's a no-op unless the gated
 * interval has actually elapsed: both premium and free users sync at most once every 24h
 * (SYNC_INTERVAL_MS above) — a product decision, not a technical limit; premium additionally gets
 * startRealtimeSync's live listener on top of this, so in practice premium propagation is
 * effectively immediate while free stays on this daily gate. Local writes always save instantly to
 * SQLite regardless (see pushLocalRow/recordDeleteBeforeRemoving); only propagation to and from the
 * cloud is throttled by plan.
 *
 * Pass force=true to bypass the interval check — e.g. a manual "Sync now" action, or right after a
 * user upgrades to premium and shouldn't have to wait for their old free-tier window to elapse.
 *
 * The pull side is a one-shot query (not a live listener), filtered on the persisted sync cursor
 * (see getSyncCursor/advanceSyncCursor above) rather than reading the collection unfiltered — a
 * device's first-ever sync for this uid has no cursor yet and correctly falls back to a full read,
 * but every subsequent run only re-fetches documents changed since this device's last successful
 * sync. The cursor uses `>=` (not `>`) so a handful of documents at the exact boundary timestamp
 * may be re-read on the next run — harmless, since mergeRemoteRecord's last-write-wins check
 * already makes reprocessing an unchanged record a no-op — trading a few duplicate reads for never
 * silently skipping a record. The query bound itself is further widened via cursorQueryFloor — see
 * its doc comment for the cross-device clock-skew this guards against. */
export async function syncIfDue(db: SQLiteDatabase, uid: string, premium: boolean, force = false): Promise<void> {
  const intervalMs = SYNC_INTERVAL_MS.daily;
  const now = Date.now();
  if (!force) {
    const lastRunAt = await getLastSyncAt(uid);
    if (now - lastRunAt < intervalMs) return;
  }

  await flushOutbox(db);

  const cursor = await getSyncCursor(uid);
  const target = cursor
    ? query(recordsCollection(uid), where('updatedAt', '>=', cursorQueryFloor(cursor)))
    : recordsCollection(uid);

  try {
    const snapshot = await getDocs(target);
    const records = snapshot.docs.map((d) => d.data() as SyncRecord);
    if (records.length > 0) {
      await mergeBatch(db, records);
      const latest = records.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), cursor ?? '');
      if (latest) await advanceSyncCursor(uid, latest);
    }
    await setLastSyncAt(uid, now);
    notifySyncStatusChange();
  } catch {
    // Offline or a transient Firestore error — don't record a completed run, so the next
    // opportunistic call (foreground, reconnect) retries rather than waiting out the full interval.
  }
}

async function setLastSyncAt(uid: string, whenMs: number): Promise<void> {
  await AsyncStorage.setItem(lastSyncAtKey(uid), String(whenMs));
}

/** The premium-only counterpart to syncIfDue's one-shot pull: a live `onSnapshot` listener on this
 * user's own records collection, so a write made on a DIFFERENT device lands on this one within a
 * second or two instead of waiting for this device to next foreground/reconnect and happen to be
 * past its daily gate. Call once (see useSyncEngine) and hold onto the returned unsubscribe —
 * calling this again without unsubscribing the previous listener would double-apply every change.
 *
 * Still uses the same sync cursor as syncIfDue (both read/advance the same AsyncStorage key) so a
 * cold start with an existing cursor only streams what actually changed since last seen, and
 * downgrading back to free mid-session and falling back to syncIfDue's polling doesn't re-process
 * anything this listener already merged. docChanges() (not the full snapshot.docs) is what keeps
 * a large synced history from being re-merged on every incremental update — only added/modified
 * documents since the last event are passed to mergeBatch. */
export function startRealtimeSync(db: SQLiteDatabase, uid: string): Unsubscribe {
  let unsubscribed = false;

  const attach = async () => {
    const cursor = await getSyncCursor(uid);
    if (unsubscribed) return () => {};
    const target = cursor ? query(recordsCollection(uid), where('updatedAt', '>=', cursorQueryFloor(cursor))) : recordsCollection(uid);

    return onSnapshot(
      target,
      async (snapshot) => {
        const records = snapshot
          .docChanges()
          .filter((change) => change.type === 'added' || change.type === 'modified')
          .map((change) => change.doc.data() as SyncRecord);
        if (records.length === 0) return;
        await mergeBatch(db, records);
        const latest = records.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), cursor ?? '');
        if (latest) await advanceSyncCursor(uid, latest);
      },
      () => {
        // Offline or a transient/permission error — the listener itself keeps retrying
        // (Firestore's own reconnect behavior); nothing to do here beyond not crashing.
      }
    );
  };

  let liveUnsubscribe: Unsubscribe | null = null;
  attach().then((unsub) => {
    if (unsubscribed) unsub();
    else liveUnsubscribe = unsub;
  });

  return () => {
    unsubscribed = true;
    liveUnsubscribe?.();
  };
}
