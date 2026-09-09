import { useCallback } from 'react';

import { useLocalTable } from '@/db/useLocalTable.web';
import type { HabitChain } from './types';

export type { ChainHabitEntry } from './types';
export { resolveChainHabits } from './types';

/**
 * Web build of useHabitChains.ts — same exported shape, backed by Dexie via useLocalTable.web
 * instead of expo-sqlite, same as every other Tier-1 hook's `.web.ts` twin.
 */
export function useHabitChains() {
  const table = useLocalTable<HabitChain>('habit_chains', {
    sort: (a, b) => a.created_at.localeCompare(b.created_at),
  });

  const createChain = useCallback(
    async (name: string, habitSyncIds: string[]) => {
      return table.insert({
        name,
        habit_sync_ids: JSON.stringify(habitSyncIds),
        created_at: new Date().toISOString(),
      } as Partial<HabitChain>);
    },
    [table]
  );

  const updateChain = useCallback(
    async (id: number, values: { name?: string; habitSyncIds?: string[] }) => {
      const columnMap: Partial<HabitChain> = {};
      if (values.name !== undefined) columnMap.name = values.name;
      if (values.habitSyncIds !== undefined) columnMap.habit_sync_ids = JSON.stringify(values.habitSyncIds);
      await table.update(id, columnMap);
    },
    [table]
  );

  const removeChain = useCallback((id: number) => table.remove(id), [table]);

  return {
    chains: table.rows,
    loading: table.loading,
    createChain,
    updateChain,
    removeChain,
    refresh: table.refresh,
  };
}
