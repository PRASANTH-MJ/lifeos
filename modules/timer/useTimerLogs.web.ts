import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, toDateKey, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { TimerLog } from './types';

/**
 * Web build of useTimerLogs.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: a write from any tab (or the sync engine) flows into every
 * mounted useTimerLogs() instance automatically.
 */
export function useTimerLogs() {
  const logs = useLiveQuery(async () => {
    const all = (await webDb.timer_logs.toArray()) as TimerLog[];
    return [...all]
      .sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : 0))
      .slice(0, 60);
  }, []);

  const loading = logs === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const logSession = useCallback(
    async (label: string | null, durationSeconds: number, habitId: number | null, taskId: number | null = null) => {
      const completedAt = new Date().toISOString();
      const id = await webDb.timer_logs.add({
        label,
        habit_id: habitId,
        task_id: taskId,
        duration_seconds: Math.round(durationSeconds),
        completed_at: completedAt,
        sync_id: Crypto.randomUUID(),
        updated_at: completedAt,
      } as never);
      await pushLocalRow('timer_logs', id as number);
      return id as number;
    },
    []
  );

  // Web mirror of useTimerLogs.ts's updateSession — see that file's doc comment.
  const updateSession = useCallback(async (id: number, updates: { taskId?: number | null; note?: string | null }) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.taskId !== undefined) patch.task_id = updates.taskId;
    if (updates.note !== undefined) patch.note = updates.note;
    await webDb.timer_logs.update(id, patch);
    await pushLocalRow('timer_logs', id);
  }, []);

  const totalMinutesThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    const totalSeconds = (logs ?? [])
      .filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo)
      .reduce((sum, log) => sum + log.duration_seconds, 0);
    return Math.round(totalSeconds / 60);
  }, [logs]);

  return { logs: logs ?? [], loading, logSession, updateSession, totalMinutesThisWeek, refresh };
}
