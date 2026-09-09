import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { todayKey } from '@/lib/date';
import { filterLogsOnDate, sumDurationSeconds } from './aggregate';
import type { TimerLog } from './types';

/**
 * Aggregate "time spent" for a single task or habit — every Pomodoro/focus session ever logged
 * against it (see "Focus on this" on the Task/Habit detail screens, and app/(tabs)/timer's
 * taskId/habitId params), not just the last-60 window useTimerLogs keeps for its own recent-
 * activity list. Pass exactly one of taskId/habitId; passing neither returns all-zero totals.
 */
export function useTimeSpent(target: { taskId?: number | null; habitId?: number | null }) {
  const db = useSQLiteContext();
  const taskId = target.taskId ?? null;
  const habitId = target.habitId ?? null;
  const [logs, setLogs] = useState<TimerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (taskId != null) {
      setLogs(await db.getAllAsync<TimerLog>('SELECT * FROM timer_logs WHERE task_id = ?', [taskId]));
    } else if (habitId != null) {
      setLogs(await db.getAllAsync<TimerLog>('SELECT * FROM timer_logs WHERE habit_id = ?', [habitId]));
    } else {
      setLogs([]);
    }
    setLoading(false);
  }, [db, taskId, habitId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const totalSeconds = useMemo(() => sumDurationSeconds(logs), [logs]);
  const todaySeconds = useMemo(() => sumDurationSeconds(filterLogsOnDate(logs, todayKey())), [logs]);

  return { loading, totalSeconds, todaySeconds, refresh };
}
