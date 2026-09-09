import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { JournalEntry } from './types';

/**
 * Web build of useJournalDetail.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any write to this row, from this tab or another,
 * flows straight into the mounted hook without a manual refresh.
 */
const PENDING = Symbol('pending');

export function useJournalDetail(entryId: number) {
  // Dexie's useLiveQuery returns `undefined` both before the query resolves AND after it
  // resolves to "no row found" — a real, valid state here (e.g. navigating to a deleted entry).
  // A distinct third-argument sentinel lets loading/not-found be told apart, unlike a bare
  // `entry === undefined` check, which would otherwise spin forever once the entry is deleted.
  const result = useLiveQuery(
    () => webDb.journal_entries.get(entryId) as Promise<JournalEntry | undefined>,
    [entryId],
    PENDING as unknown as JournalEntry | undefined
  );
  const loading = (result as unknown) === PENDING;
  const entry = loading ? undefined : (result as JournalEntry | undefined);

  const updateEntry = useCallback(
    async (values: Partial<Pick<JournalEntry, 'body' | 'mood'>>) => {
      await webDb.journal_entries.update(entryId, { ...values, updated_at: new Date().toISOString() });
      await pushLocalRow('journal_entries', entryId);
    },
    [entryId]
  );

  const deleteEntry = useCallback(async () => {
    await recordDeleteBeforeRemoving('journal_entries', entryId);
    await webDb.journal_entries.delete(entryId);
  }, [entryId]);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { entry: entry ?? null, loading, updateEntry, deleteEntry, refresh };
}
