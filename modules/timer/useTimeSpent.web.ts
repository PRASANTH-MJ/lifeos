import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { filterLogsOnDate, sumDurationSeconds } from './aggregate';
import type { TimerLog } from './types';

/**
 * Web build of useTimeSpent.ts — same exported shape. timer_logs' Dexie index only covers
 * habit_id (not task_id, added later on the native side — see db/schema.ts's v57 migration), so
 * both branches filter client-side rather than `.where('task_id')`/`.where('habit_id')`, which
 * would throw a Dexie SchemaError for the un-indexed column (same reasoning as
 * useCheckins.web.ts's date filtering).
 */
export function useTimeSpent(target: { taskId?: number | null; habitId?: number | null }) {
  const taskId = target.taskId ?? null;
  const habitId = target.habitId ?? null;

  const logs = useLiveQuery(async () => {
    if (taskId == null && habitId == null) return [];
    const all = (await webDb.timer_logs.toArray()) as TimerLog[];
    return all.filter((log) => (taskId != null ? log.task_id === taskId : log.habit_id === habitId));
  }, [taskId, habitId]);

  const loading = logs === undefined;
  const totalSeconds = useMemo(() => sumDurationSeconds(logs ?? []), [logs]);
  const todaySeconds = useMemo(() => sumDurationSeconds(filterLogsOnDate(logs ?? [], todayKey())), [logs]);

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { loading, totalSeconds, todaySeconds, refresh };
}
