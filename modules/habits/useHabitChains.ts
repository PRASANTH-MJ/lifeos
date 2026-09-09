import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { HabitChain } from './types';

export type { ChainHabitEntry } from './types';
export { resolveChainHabits } from './types';

/**
 * CRUD for habit_chains — a user-defined ordered sequence of existing habits meant to be done
 * back-to-back (e.g. "Wake up → Drink water → Stretch → Journal"). Deliberately thin: no
 * dedicated progress-tracking columns here — "checking off" a habit within a chain just calls
 * useHabits' own upsertLog/toggleToday for that habit, so a chain's progress is always exactly
 * today's regular per-habit check-in state (see app/(tabs)/habits/chain/[id].tsx).
 */
export function useHabitChains() {
  const table = useLocalTable<HabitChain>('habit_chains', { orderBy: 'created_at ASC' });

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
