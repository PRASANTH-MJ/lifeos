import { useCallback, useMemo } from 'react';

// Explicit .web import — '@/db' barrel resolves to the native useLocalTable.ts's QueryOptions
// (where/params/orderBy strings) for tsc's cross-file type-checking, even though Metro correctly
// bundles this file's filter/sort-based web version at runtime.
import { useLocalTable } from '@/db/useLocalTable.web';
import { dateKeyToTimestamp } from '@/lib/date';
import type { JournalEntry } from './types';

/**
 * Web build of useJournal.ts — same exported shape. `WHERE body LIKE ?` becomes a JS
 * substring filter and `ORDER BY created_at DESC` becomes a JS comparator, both passed to
 * useLocalTable.web.ts (Dexie/useLiveQuery-backed), so entries stay reactive across tabs.
 */
export function useJournal(searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase();

  const filter = useMemo(() => {
    if (!trimmed) return undefined;
    return (row: JournalEntry) => (row.body ?? '').toLowerCase().includes(trimmed);
  }, [trimmed]);

  const sort = useMemo(() => {
    return (a: JournalEntry, b: JournalEntry) => (b.created_at ?? '').localeCompare(a.created_at ?? '');
  }, []);

  const table = useLocalTable<JournalEntry>('journal_entries', { filter, sort });

  const createEntry = useCallback(
    (values: { body: string; mood: string | null; prompt: string | null; dateKey?: string }) => {
      const timestamp = values.dateKey ? dateKeyToTimestamp(values.dateKey) : new Date().toISOString();
      return table.insert({
        body: values.body,
        mood: values.mood,
        prompt: values.prompt,
        created_at: timestamp,
        updated_at: timestamp,
      } as Partial<JournalEntry>);
    },
    [table]
  );

  return { entries: table.rows, loading: table.loading, createEntry, refresh: table.refresh };
}
