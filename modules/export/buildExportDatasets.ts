import type { SQLiteDatabase } from 'expo-sqlite';

export type ExportDatasets = Record<string, Record<string, unknown>[]>;

/** "Export everything" per the product decision — the 4 datasets a user actually thinks of as
 * "my data": habits, tasks (single + recurring together), journal entries, finance transactions.
 * Plain `SELECT *` rather than hand-picked columns — these tables have picked up columns across
 * dozens of migrations, so this stays correct without needing to track that list by hand. */
export async function buildExportDatasets(db: SQLiteDatabase): Promise<ExportDatasets> {
  const [habits, tasks, journalEntries, financeTransactions] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM habits WHERE archived = 0 ORDER BY id'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM tasks WHERE archived = 0 ORDER BY id'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM journal_entries ORDER BY created_at'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM finance_transactions ORDER BY date'),
  ]);

  return {
    Habits: habits,
    Tasks: tasks,
    'Journal Entries': journalEntries,
    'Finance Transactions': financeTransactions,
  };
}
