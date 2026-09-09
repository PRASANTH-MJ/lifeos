import { webDb, ALL_WEB_DB_TABLES } from './webDb';
import { getLegacyOpfsDb, legacyRowCount, legacyRowsAfter, legacyAllRows, legacyTableExists } from './legacyOpfsDb';

const MIGRATION_KEY = 'opfs_to_indexeddb';
const BATCH_SIZE = 500;

/** Tables with no surrogate `id` column — migrated as a single full-table copy (both are
 * expected to stay small) instead of the id-cursor batching every other table uses. */
const NO_ID_TABLES = new Set(['sync_tombstones', 'finance_transaction_labels']);

export type MigrationProgress = { table: string; doneTables: number; totalTables: number };

async function migrateTableById(table: string, cursorStart: number, onProgress?: (p: MigrationProgress) => void): Promise<void> {
  const legacyDb = await getLegacyOpfsDb();
  let cursor = cursorStart;

  while (true) {
    const rows = await legacyRowsAfter(legacyDb, table, cursor, BATCH_SIZE);
    if (rows.length === 0) break;

    await webDb.table(table).bulkPut(rows as Record<string, unknown>[]);
    cursor = Math.max(...rows.map((r) => Number(r.id)));

    const status = await webDb.migration_status.get(MIGRATION_KEY);
    const perTableCursor = { ...(status?.perTableCursor ?? {}), [table]: cursor };
    await webDb.migration_status.put({ key: MIGRATION_KEY, state: 'in_progress', perTableCursor });

    if (rows.length < BATCH_SIZE) break;
  }
}

async function migrateTableWholesale(table: string): Promise<void> {
  const legacyDb = await getLegacyOpfsDb();
  const rows = await legacyAllRows(legacyDb, table);
  if (rows.length === 0) return;
  await webDb.table(table).bulkPut(rows);
}

async function verifyTable(table: string): Promise<boolean> {
  const legacyDb = await getLegacyOpfsDb();

  // A table that doesn't exist at all in the legacy OPFS db means this device never ran the
  // native migrateDbIfNeeded chain against it — a genuinely fresh web install with nothing to
  // carry over. webDb.on('populate') already seeds default rows for singleton tables
  // (workout_preferences, app_settings, finance_budgets, user_profile, user_details,
  // water_preferences, cycle_preferences) the moment IndexedDB is first created, *before* this
  // migration ever runs — comparing counts against a legacy table that was never created would
  // wrongly flag those population-seeded defaults as a mismatch. Nothing to migrate here, so
  // whatever webDb already holds (empty, or a populate-seeded default) is correct as-is.
  if (!(await legacyTableExists(legacyDb, table))) return true;

  const legacyCount = await legacyRowCount(legacyDb, table);
  const webCount = await webDb.table(table).count();
  return legacyCount === webCount;
}

async function migrateOneTable(table: string, perTableCursor: Record<string, number>): Promise<void> {
  if (NO_ID_TABLES.has(table)) {
    await migrateTableWholesale(table);
  } else {
    await migrateTableById(table, perTableCursor[table] ?? 0);
  }

  if (await verifyTable(table)) return;

  // One retry from scratch before giving up — bulkPut is idempotent (upsert by primary key), so
  // a full re-copy after a partial/interrupted run never duplicates rows.
  if (!NO_ID_TABLES.has(table)) {
    await migrateTableById(table, 0);
  } else {
    await migrateTableWholesale(table);
  }

  if (!(await verifyTable(table))) {
    throw new Error(`Migration verification failed for table "${table}": row counts don't match after retry.`);
  }
}

async function runMigration(onProgress?: (p: MigrationProgress) => void): Promise<void> {
  const status = await webDb.migration_status.get(MIGRATION_KEY);
  const perTableCursor = status?.perTableCursor ?? {};

  await webDb.migration_status.put({ key: MIGRATION_KEY, state: 'in_progress', perTableCursor });

  for (let i = 0; i < ALL_WEB_DB_TABLES.length; i++) {
    const table = ALL_WEB_DB_TABLES[i];
    await migrateOneTable(table, perTableCursor);
    onProgress?.({ table, doneTables: i + 1, totalTables: ALL_WEB_DB_TABLES.length });
  }

  // Flag last — only written after every table has verified clean. An interrupted run before
  // this point just leaves state 'in_progress' with partial per-table cursors; the next load
  // resumes from where it left off rather than restarting or duplicating.
  await webDb.migration_status.put({ key: MIGRATION_KEY, state: 'done', perTableCursor: {} });
}

/** Runs the one-time OPFS SQLite → IndexedDB carry-over for existing web users. Safe to call on
 * every StorageProvider.web.tsx mount: fast-exits immediately if already done, and guards the
 * actual migration with a Web Lock so two tabs open during rollout don't both run it — the
 * second tab blocks on the lock, then finds state 'done' already and returns immediately. */
export async function migrateOpfsToIndexedDbIfNeeded(onProgress?: (p: MigrationProgress) => void): Promise<void> {
  const existing = await webDb.migration_status.get(MIGRATION_KEY);
  if (existing?.state === 'done') return;

  await navigator.locks.request('flowsy-opfs-migration', async () => {
    const status = await webDb.migration_status.get(MIGRATION_KEY);
    if (status?.state === 'done') return;
    await runMigration(onProgress);
  });
}
