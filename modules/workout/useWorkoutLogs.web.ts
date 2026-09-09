import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

type WorkoutLog = { id: number; workout_key: string; completed_at: string; duration_seconds: number | null };

/**
 * Web build of useWorkoutLogs.ts — same exported shape. Reactive via useLiveQuery instead of
 * the native useFocusEffect-based refresh, so every tab's view updates the instant any tab (or
 * the sync engine) writes to workout_logs. `refresh` is kept as a no-op for callers that still
 * `await` it.
 */
export function useWorkoutLogs() {
  const logs = useLiveQuery(async () => {
    const all = (await webDb.workout_logs.toArray()) as WorkoutLog[];
    return [...all]
      .sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : 0))
      .slice(0, 60);
  }, []);

  const loading = logs === undefined;
  const resolvedLogs = logs ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const logCompletion = useCallback(async (workoutKey: string, dateKey?: string, durationSeconds?: number) => {
    const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
    const id = await webDb.workout_logs.add({
      workout_key: workoutKey,
      completed_at: completedAt,
      duration_seconds: durationSeconds ?? null,
      sync_id: Crypto.randomUUID(),
      updated_at: completedAt,
    } as never);
    await pushLocalRow('workout_logs', id as number);
  }, []);

  const removeLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('workout_logs', id);
    await webDb.workout_logs.delete(id);
  }, []);

  const completedThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return resolvedLogs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [resolvedLogs]);

  return { logs: resolvedLogs, loading, logCompletion, removeLog, completedThisWeek, refresh };
}
