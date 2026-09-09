import { webDb } from '@/db/webDb';
import type { ExportDatasets } from './buildExportDatasets';

/** Web build of buildExportDatasets.ts — same 4 fixed datasets, filtered/sorted client-side
 * (these tables are small; no reason to add indexes purely for a read-only export path). */
export async function buildExportDatasets(): Promise<ExportDatasets> {
  const [habits, tasks, journalEntries, financeTransactions] = await Promise.all([
    webDb.habits.toArray(),
    webDb.tasks.toArray(),
    webDb.journal_entries.toArray(),
    webDb.finance_transactions.toArray(),
  ]);

  return {
    Habits: habits.filter((row) => !row.archived).sort((a, b) => (a.id as number) - (b.id as number)),
    Tasks: tasks.filter((row) => !row.archived).sort((a, b) => (a.id as number) - (b.id as number)),
    'Journal Entries': journalEntries.sort((a, b) =>
      (a.created_at as string) < (b.created_at as string) ? -1 : (a.created_at as string) > (b.created_at as string) ? 1 : 0
    ),
    'Finance Transactions': financeTransactions.sort((a, b) =>
      (a.date as string) < (b.date as string) ? -1 : (a.date as string) > (b.date as string) ? 1 : 0
    ),
  };
}
