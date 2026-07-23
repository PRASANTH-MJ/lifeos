import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { JournalEntry } from './types';

export function useJournal(searchQuery: string) {
  const trimmed = searchQuery.trim();
  const table = useLocalTable<JournalEntry>('journal_entries', {
    where: trimmed ? 'body LIKE ?' : undefined,
    params: trimmed ? [`%${trimmed}%`] : [],
    orderBy: 'created_at DESC',
  });

  const createEntry = useCallback(
    (values: { body: string; mood: string | null; prompt: string | null }) => {
      const now = new Date().toISOString();
      return table.insert({
        body: values.body,
        mood: values.mood,
        prompt: values.prompt,
        created_at: now,
        updated_at: now,
      } as Partial<JournalEntry>);
    },
    [table]
  );

  return { entries: table.rows, loading: table.loading, createEntry, refresh: table.refresh };
}
