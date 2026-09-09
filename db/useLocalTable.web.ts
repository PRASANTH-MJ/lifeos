import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from './webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

type Row = { id: number };

/**
 * Web build of useLocalTable.ts — same generic CRUD-over-one-table shape, but reactive via
 * Dexie's useLiveQuery instead of expo-router's useFocusEffect: every tab showing this table
 * re-renders automatically the instant ANY tab (or the sync engine) writes to it, which is the
 * actual point of this migration. No manual refresh() call is needed after insert/update/remove
 * (kept as a no-op-returning function only so callers that awaited it don't need changing), but
 * it's still exposed for callers that want to force a one-off re-read.
 *
 * `where`/`orderBy` SQL fragments have no Dexie equivalent, so this takes plain JS predicate/
 * comparator functions instead — each Tier-1 consumer hook gets its own `.web.ts` twin that
 * translates its native `where`/`orderBy` string into the equivalent `filter`/`sort` here. These
 * tables are all small (personal life-tracking data, at most a few hundred rows), so filtering/
 * sorting the full table client-side has no meaningful performance cost.
 */
export type QueryOptions<T = unknown> = {
  filter?: (row: T) => boolean;
  sort?: (a: T, b: T) => number;
};

export function useLocalTable<T extends Row>(table: string, options: QueryOptions<T> = {}) {
  const { filter, sort } = options;

  const rows = useLiveQuery(async () => {
    const all = (await webDb.table(table).toArray()) as T[];
    const filtered = filter ? all.filter(filter) : all;
    return sort ? [...filtered].sort(sort) : filtered;
  }, [table, filter, sort]);

  const loading = rows === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await table.refresh()` don't need changing.
  }, []);

  const insert = useCallback(
    async (values: Partial<T>) => {
      const withSync = {
        ...values,
        sync_id: (values as Record<string, unknown>).sync_id ?? Crypto.randomUUID(),
        updated_at: (values as Record<string, unknown>).updated_at ?? new Date().toISOString(),
      };
      const id = await webDb.table(table).add(withSync as never);
      await pushLocalRow(table, id as number);
      return id as number;
    },
    [table]
  );

  const update = useCallback(
    async (id: number, values: Partial<T>) => {
      const withSync = { ...values, updated_at: (values as Record<string, unknown>).updated_at ?? new Date().toISOString() };
      await webDb.table(table).update(id, withSync as never);
      await pushLocalRow(table, id);
    },
    [table]
  );

  const remove = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(table, id);
      await webDb.table(table).delete(id);
    },
    [table]
  );

  return { rows: rows ?? [], loading, refresh, insert, update, remove };
}
