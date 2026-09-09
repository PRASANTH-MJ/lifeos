import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IndexableType } from 'dexie';
import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { firestore } from '@/firebase/config';
import { webDb } from '@/db/webDb';
import { syncConfigFor, SYNC_TABLES } from './syncSchema';

/**
 * Web build of the sync engine — same exported names/behavior as syncEngine.ts, translated
 * from raw SQL to Dexie's table API. webDb is a module-level singleton (Dexie's own idiom, no
 * React-context handle needed the way expo-sqlite's useSQLiteContext() provides one), so the
 * exported functions here drop the `db` parameter their native counterparts take — internal
 * plumbing only consumed by useLocalTable.web.ts and a handful of feature hooks in this port,
 * never by outer UI components, so this doesn't affect the platform-branching discipline that
 * matters (hook exports consumed by ~60 UI files staying shape-identical).
 */

type SyncRecord = {
  table: string;
  syncId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted: boolean;
};

let currentUid: string | null = null;
export function setSyncUid(uid: string | null): void {
  currentUid = uid;
}

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

function syncCursorKey(uid: string): string {
  return `flowsy-sync-cursor-${uid}`;
}

async function getSyncCursor(uid: string): Promise<string | null> {
  return AsyncStorage.getItem(syncCursorKey(uid));
}

async function advanceSyncCursor(uid: string, candidate: string): Promise<void> {
  const current = await AsyncStorage.getItem(syncCursorKey(uid));
  if (!current || candidate > current) {
    await AsyncStorage.setItem(syncCursorKey(uid), candidate);
  }
}

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

export async function getLastSyncedAt(uid: string): Promise<number | null> {
  const ms = await getLastSyncAt(uid);
  return ms > 0 ? ms : null;
}

async function resolveForeignKeysOutgoing(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = syncConfigFor(table);
  if (!config?.foreignKeys) return data;
  const resolved = { ...data };
  for (const fk of config.foreignKeys) {
    const localId = data[fk.column];
    if (localId == null) continue;
    const parent = await webDb.table(fk.referencesTable).get(localId as number);
    resolved[fk.column] = (parent?.sync_id as string | undefined) ?? null;
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

/** Web counterpart of syncEngine.ts's onLocalWrite — same idiom, see that file's doc comment. */
type LocalWriteListener = (table: string) => void;
const localWriteListeners = new Set<LocalWriteListener>();

export function onLocalWrite(listener: LocalWriteListener): () => void {
  localWriteListeners.add(listener);
  return () => localWriteListeners.delete(listener);
}

function notifyLocalWrite(table: string): void {
  for (const listener of localWriteListeners) listener(table);
}

async function enqueue(record: SyncRecord): Promise<void> {
  await webDb.sync_outbox.where('sync_id').equals(record.syncId).and((r) => r.table_name === record.table).delete();
  const id = await webDb.sync_outbox.add({
    table_name: record.table,
    sync_id: record.syncId,
    payload: JSON.stringify(record),
    created_at: new Date().toISOString(),
  } as never);
  notifySyncStatusChange();
  notifyLocalWrite(record.table);

  if (currentPremium && currentUid) {
    // Fire-and-forget — see syncEngine.ts's enqueue() doc comment for why this isn't awaited.
    pushToFirestore(record)
      .then(() => webDb.sync_outbox.delete(id))
      .then(() => notifySyncStatusChange())
      .catch(() => {
        // Left queued — the next due (or realtime-listener-triggered) flush retries it.
      });
  }
}

// `localId` is normally a plain number (every table's Dexie primary key is `++id`) but accepts
// any Dexie-indexable key: finance_transaction_labels' primary key is the compound
// [transaction_id, label_id] array, since it has no surrogate id column (mirrors native
// SQLite's use of the implicit `rowid` for that same table — see syncEngine.ts).
export async function pushLocalRow(table: string, localId: IndexableType): Promise<void> {
  const row = await webDb.table(table).get(localId);
  if (!row || !row.sync_id) return;
  const { id, sync_id, updated_at, ...rest } = row;
  const data = await resolveForeignKeysOutgoing(table, rest);
  await enqueue({ table, syncId: sync_id as string, data, updatedAt: (updated_at as string) ?? new Date().toISOString(), deleted: false });
}

export async function recordDeleteBeforeRemoving(table: string, localId: IndexableType): Promise<void> {
  const row = await webDb.table(table).get(localId);
  if (!row?.sync_id) return;
  const now = new Date().toISOString();
  await webDb.sync_tombstones.put({ sync_id: row.sync_id as string, table_name: table, deleted_at: now });
  await enqueue({ table, syncId: row.sync_id as string, data: {}, updatedAt: now, deleted: true });
}

async function flushOutbox(): Promise<void> {
  if (!currentUid) return;
  const rows = await webDb.sync_outbox.orderBy('id').toArray();
  for (const row of rows) {
    try {
      await pushToFirestore(JSON.parse(row.payload) as SyncRecord);
      await webDb.sync_outbox.delete(row.id);
    } catch {
      // Leave it — the next due sync retries.
    }
  }
  if (rows.length > 0) notifySyncStatusChange();
}

/** Web mirror of syncEngine.ts's local-edit-overwritten notice — see that file's doc comment. */
type LocalEditOverwrittenListener = (info: { table: string; syncId: string }) => void;
const localEditOverwrittenListeners = new Set<LocalEditOverwrittenListener>();

export function onLocalEditOverwritten(listener: LocalEditOverwrittenListener): () => void {
  localEditOverwrittenListeners.add(listener);
  return () => localEditOverwrittenListeners.delete(listener);
}

const RECENT_LOCAL_EDIT_MS = 60_000;

class ParentNotFoundError extends Error {}

async function mergeRemoteRecord(record: SyncRecord): Promise<void> {
  const { table, syncId, data, updatedAt, deleted } = record;
  if (!syncConfigFor(table)) return;

  const dexieTable = webDb.table(table);

  if (deleted) {
    // .where(...).delete() removes by whatever the table's actual primary key is (a scalar
    // `id` for most tables, or the compound [transaction_id, label_id] key for
    // finance_transaction_labels) without this function needing to know its shape.
    await dexieTable.where('sync_id').equals(syncId).delete();
    await webDb.sync_tombstones.put({ sync_id: syncId, table_name: table, deleted_at: updatedAt });
    return;
  }

  const tombstoned = await webDb.sync_tombstones.get(syncId);
  if (tombstoned) return;

  const config = syncConfigFor(table);
  const resolved: Record<string, unknown> = { ...data };
  for (const fk of config?.foreignKeys ?? []) {
    const remoteRef = data[fk.column];
    if (remoteRef == null) {
      resolved[fk.column] = null;
      continue;
    }
    const parent = await webDb.table(fk.referencesTable).where('sync_id').equals(remoteRef as string).first();
    if (!parent) throw new ParentNotFoundError();
    resolved[fk.column] = (parent as { id: number }).id;
  }

  const existing = await dexieTable.where('sync_id').equals(syncId).first();

  if (existing) {
    const existingUpdatedAt = (existing as { updated_at?: string }).updated_at;
    if (existingUpdatedAt && existingUpdatedAt >= updatedAt) return; // last-write-wins
    if (existingUpdatedAt && Date.now() - Date.parse(existingUpdatedAt) < RECENT_LOCAL_EDIT_MS) {
      console.warn(`[sync] local edit to ${table}/${syncId} made in the last ${RECENT_LOCAL_EDIT_MS / 1000}s was overwritten by a newer remote change`);
      for (const listener of localEditOverwrittenListeners) listener({ table, syncId });
    }
    await dexieTable.where('sync_id').equals(syncId).modify(resolved);
  } else {
    await dexieTable.add({ ...resolved, sync_id: syncId } as never);
  }
}

type MergeListener = (tables: ReadonlySet<string>) => void;
const mergeListeners = new Set<MergeListener>();

export function onSyncMerge(listener: MergeListener): () => void {
  mergeListeners.add(listener);
  return () => mergeListeners.delete(listener);
}

async function mergeBatch(records: SyncRecord[]): Promise<void> {
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
        await mergeRemoteRecord(record);
      } catch (error) {
        if (error instanceof ParentNotFoundError) deferred.push(record);
      }
    }
    for (const record of deferred) {
      await mergeRemoteRecord(record).catch(() => {});
    }
  }

  const touchedTables = new Set(byTable.keys());
  for (const listener of mergeListeners) listener(touchedTables);
}

export async function syncIfDue(uid: string, premium: boolean, force = false): Promise<void> {
  const intervalMs = SYNC_INTERVAL_MS.daily;
  const now = Date.now();
  if (!force) {
    const lastRunAt = await getLastSyncAt(uid);
    if (now - lastRunAt < intervalMs) return;
  }

  await flushOutbox();

  const cursor = await getSyncCursor(uid);
  const target = cursor
    ? query(recordsCollection(uid), where('updatedAt', '>=', cursor))
    : recordsCollection(uid);

  try {
    const snapshot = await getDocs(target);
    const records = snapshot.docs.map((d) => d.data() as SyncRecord);
    if (records.length > 0) {
      await mergeBatch(records);
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

/** Web counterpart to syncEngine.ts's startRealtimeSync — same shape, Dexie instead of SQLite.
 * See that file's doc comment for the full reasoning. */
export function startRealtimeSync(uid: string): Unsubscribe {
  let unsubscribed = false;

  const attach = async () => {
    const cursor = await getSyncCursor(uid);
    if (unsubscribed) return () => {};
    const target = cursor ? query(recordsCollection(uid), where('updatedAt', '>=', cursor)) : recordsCollection(uid);

    return onSnapshot(
      target,
      async (snapshot) => {
        const records = snapshot
          .docChanges()
          .filter((change) => change.type === 'added' || change.type === 'modified')
          .map((change) => change.doc.data() as SyncRecord);
        if (records.length === 0) return;
        await mergeBatch(records);
        const latest = records.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), cursor ?? '');
        if (latest) await advanceSyncCursor(uid, latest);
      },
      () => {
        // Offline or a transient/permission error — the listener itself keeps retrying.
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
