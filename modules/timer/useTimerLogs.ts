import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, toDateKey, todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync';
import type { TimerLog } from './types';

export function useTimerLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<TimerLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<TimerLog>('SELECT * FROM timer_logs ORDER BY completed_at DESC LIMIT 60');
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const logSession = useCallback(
    async (label: string | null, durationSeconds: number, habitId: number | null, taskId: number | null = null) => {
      const completedAt = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO timer_logs (label, habit_id, task_id, duration_seconds, completed_at, sync_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [label, habitId, taskId, Math.round(durationSeconds), completedAt, Crypto.randomUUID(), completedAt]
      );
      await pushLocalRow(db, 'timer_logs', result.lastInsertRowId);
      await refresh();
      return result.lastInsertRowId;
    },
    [db, refresh]
  );

  // Attaches a task and/or a note to a session after the fact — the "Add details" prompt shown
  // once a session is saved (see app/(tabs)/timer/index.tsx) can't know which task the user wants
  // to log against until the session is already done, unlike the habit_id/taskId logSession
  // already accepts for a session started FROM a task/habit's "Focus on this" button.
  const updateSession = useCallback(
    async (id: number, updates: { taskId?: number | null; note?: string | null }) => {
      const updatedAt = new Date().toISOString();
      if (updates.taskId !== undefined) {
        await db.runAsync('UPDATE timer_logs SET task_id = ?, updated_at = ? WHERE id = ?', [updates.taskId, updatedAt, id]);
      }
      if (updates.note !== undefined) {
        await db.runAsync('UPDATE timer_logs SET note = ?, updated_at = ? WHERE id = ?', [updates.note, updatedAt, id]);
      }
      await pushLocalRow(db, 'timer_logs', id);
      await refresh();
    },
    [db, refresh]
  );

  const totalMinutesThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    const totalSeconds = logs
      .filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo)
      .reduce((sum, log) => sum + log.duration_seconds, 0);
    return Math.round(totalSeconds / 60);
  }, [logs]);

  return { logs, loading, logSession, updateSession, totalMinutesThisWeek, refresh };
}
