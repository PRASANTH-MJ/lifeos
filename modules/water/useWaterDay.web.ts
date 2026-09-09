import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

export type WaterLog = { id: number; amount_ml: number; date: string; created_at: string };

/**
 * Web build of useWaterDay.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: a write from any tab (own insert/delete, the goal update, or
 * a sync merge) re-runs this query and updates every mounted useWaterDay() instance automatically.
 */
export function useWaterDay(dateKey: string) {
  const logs = useLiveQuery(async () => {
    const all = (await webDb.water_logs.toArray()) as WaterLog[];
    return all
      .filter((row) => row.date === dateKey)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [dateKey]);

  const goalMl = useLiveQuery(async () => {
    const prefRow = (await webDb.water_preferences.get(1)) as { goal_ml: number } | undefined;
    return prefRow?.goal_ml ?? 2000;
  }, []);

  const loading = logs === undefined || goalMl === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addLog = useCallback(
    async (amountMl: number) => {
      const now = new Date().toISOString();
      const id = await webDb.water_logs.add({
        amount_ml: amountMl,
        date: dateKey,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
      } as never);
      await pushLocalRow('water_logs', id as number);
    },
    [dateKey]
  );

  const removeLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('water_logs', id);
    await webDb.water_logs.delete(id);
  }, []);

  const setGoal = useCallback(async (nextGoalMl: number) => {
    const now = new Date().toISOString();
    const existing = await webDb.water_preferences.get(1);
    if (existing) {
      await webDb.water_preferences.update(1, { goal_ml: nextGoalMl, updated_at: now });
    } else {
      // sync_id set on this fresh-insert branch only — the update() branch above merges rather
      // than replaces, so it can't clobber an existing sync_id the way a bare put() would.
      await webDb.water_preferences.put({ id: 1, goal_ml: nextGoalMl, updated_at: now, sync_id: 'singleton' } as never);
    }
    await pushLocalRow('water_preferences', 1);
  }, []);

  const totalMl = useMemo(() => (logs ?? []).reduce((sum, l) => sum + l.amount_ml, 0), [logs]);

  return { logs: logs ?? [], totalMl, goalMl: goalMl ?? 2000, loading, addLog, removeLog, setGoal, refresh };
}
