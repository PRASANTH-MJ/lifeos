import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { JournalEntry } from './types';

export function useJournalDetail(entryId: number) {
  const db = useSQLiteContext();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<JournalEntry>('SELECT * FROM journal_entries WHERE id = ?', [entryId]);
    setEntry(row);
    setLoading(false);
  }, [db, entryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateEntry = useCallback(
    async (values: Partial<Pick<JournalEntry, 'body' | 'mood'>>) => {
      const keys = Object.keys(values) as (keyof typeof values)[];
      const setClause = keys.map((key) => `${key} = ?`).join(', ');
      await db.runAsync(`UPDATE journal_entries SET ${setClause}, updated_at = ? WHERE id = ?`, [
        ...keys.map((key) => values[key] as string | null),
        new Date().toISOString(),
        entryId,
      ]);
      await refresh();
    },
    [db, entryId, refresh]
  );

  const deleteEntry = useCallback(async () => {
    await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [entryId]);
  }, [db, entryId]);

  return { entry, loading, updateEntry, deleteEntry, refresh };
}
