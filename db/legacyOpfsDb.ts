import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from './schema';

/**
 * Read-only-by-convention accessor for the pre-migration OPFS SQLite database, used only by
 * db/migrateOpfsToIndexedDb.ts to carry existing web users' data into IndexedDB. Never opened
 * once migration_status is 'done' — the OPFS file itself is left untouched as a rollback
 * safety net, not deleted, for at least one release.
 *
 * Opening the same database name expo-sqlite's own web backend uses is safe here because by
 * the time this module is ever imported (web StorageProvider, before any <SQLiteProvider> would
 * exist), nothing else on web holds a handle to it — SQLiteProvider itself has been replaced by
 * StorageProvider for the web build.
 */
let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getLegacyOpfsDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

export async function legacyTableExists(db: SQLiteDatabase, table: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table]
  );
  return row != null;
}

export async function legacyRowCount(db: SQLiteDatabase, table: string): Promise<number> {
  if (!(await legacyTableExists(db, table))) return 0;
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
  return row?.count ?? 0;
}

export async function legacyRowsAfter(
  db: SQLiteDatabase,
  table: string,
  afterId: number,
  limit: number
): Promise<Record<string, unknown>[]> {
  if (!(await legacyTableExists(db, table))) return [];
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE id > ? ORDER BY id ASC LIMIT ?`,
    [afterId, limit]
  );
}

/** sync_tombstones and finance_transaction_labels have no surrogate `id` column — migrated as a
 * single full-table copy instead of the id-cursor batching every other table uses, since there's
 * no monotonic column to page on and both tables are expected to stay small. */
export async function legacyAllRows(db: SQLiteDatabase, table: string): Promise<Record<string, unknown>[]> {
  if (!(await legacyTableExists(db, table))) return [];
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}
