import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import { firestore } from '@/firebase/config';
import { syncConfigFor, SYNC_TABLES } from './syncSchema';

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

function recordDocId(table: string, syncId: string): string {
  return `${table}__${syncId}`;
}

function recordsCollection(uid: string) {
  return collection(firestore, 'users', uid, 'records');
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

async function enqueue(db: SQLiteDatabase, record: SyncRecord): Promise<void> {
  const payload = JSON.stringify(record);
  await db.runAsync('INSERT INTO sync_outbox (table_name, sync_id, payload, created_at) VALUES (?, ?, ?, ?)', [
    record.table,
    record.syncId,
    payload,
    new Date().toISOString(),
  ]);
  try {
    await pushToFirestore(record);
    await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND sync_id = ? AND payload = ?', [
      record.table,
      record.syncId,
      payload,
    ]);
  } catch {
    // Stays in the outbox — flushOutbox retries it later (offline, or a transient error).
  }
}

/** Call after every local insert/update, once the row has its final id/sync_id/updated_at
 * committed — re-reads the row and pushes its current state. One function covers both insert and
 * update, since it doesn't care what changed, only what the row looks like now. */
export async function pushLocalRow(db: SQLiteDatabase, table: string, localId: number): Promise<void> {
  const row = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [localId]);
  if (!row || !row.sync_id) return;
  const { id, sync_id, updated_at, ...rest } = row;
  const data = await resolveForeignKeysOutgoing(db, table, rest);
  await enqueue(db, { table, syncId: sync_id as string, data, updatedAt: (updated_at as string) ?? new Date().toISOString(), deleted: false });
}

/** Call before removing a row locally — records a tombstone (so a remote listener can tell
 * "deleted" apart from "never existed") and pushes the deletion marker. */
export async function recordDeleteBeforeRemoving(db: SQLiteDatabase, table: string, localId: number): Promise<void> {
  const row = await db.getFirstAsync<{ sync_id: string | null }>(`SELECT sync_id FROM ${table} WHERE id = ?`, [localId]);
  if (!row?.sync_id) return;
  const now = new Date().toISOString();
  await db.runAsync('INSERT OR REPLACE INTO sync_tombstones (sync_id, table_name, deleted_at) VALUES (?, ?, ?)', [
    row.sync_id,
    table,
    now,
  ]);
  await enqueue(db, { table, syncId: row.sync_id, data: {}, updatedAt: now, deleted: true });
}

export async function flushOutbox(db: SQLiteDatabase): Promise<void> {
  if (!currentUid) return;
  const rows = await db.getAllAsync<{ id: number; payload: string }>('SELECT id, payload FROM sync_outbox ORDER BY id ASC');
  for (const row of rows) {
    try {
      await pushToFirestore(JSON.parse(row.payload) as SyncRecord);
      await db.runAsync('DELETE FROM sync_outbox WHERE id = ?', [row.id]);
    } catch {
      // Leave it — the next flush (foreground, reconnect) retries.
    }
  }
}

class ParentNotFoundError extends Error {}

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

  const existing = await db.getFirstAsync<{ id: number; updated_at: string | null }>(
    `SELECT id, updated_at FROM ${table} WHERE sync_id = ?`,
    [syncId]
  );

  if (existing) {
    if (existing.updated_at && existing.updated_at >= updatedAt) return; // local already same-or-newer (last-write-wins)
    const columns = Object.keys(resolved);
    if (columns.length === 0) return;
    const setClause = columns.map((column) => `${column} = ?`).join(', ');
    await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
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

/** Mounted once near the root (see app/_layout.tsx) — keeps a single Firestore listener alive
 * for as long as the app is signed in, covering every synced table via one flat collection
 * rather than 30 separate per-table listeners. */
export function startSyncListener(db: SQLiteDatabase, uid: string): () => void {
  return onSnapshot(
    recordsCollection(uid),
    (snapshot) => {
      const records = snapshot.docChanges().map((change) => change.doc.data() as SyncRecord);
      if (records.length > 0) mergeBatch(db, records).catch(() => {});
    },
    () => {
      // Offline or a transient Firestore error — local data stays exactly as it is; the listener
      // resubscribes automatically once connectivity returns.
    }
  );
}
