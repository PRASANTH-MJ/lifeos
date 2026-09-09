import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow } from '@/modules/sync';

export type RoutineProgress = {
  programKey: string;
  dayIndex: number;
  weekNumber: number;
  startedAt: string;
};

export type RoutineDayLog = { dayKey: string; weekNumber: number };

/** Tracks which workout program a user is currently running and which day/week they're on
 * (`routine_progress`, a singleton row like workout_preferences) plus a history of completed
 * days (`routine_day_logs`) — both tables existed in the schema, ready for sync, since the
 * program-progress feature was first scaffolded, but nothing ever actually wrote to them until
 * now. */
export function useRoutineProgress() {
  const db = useSQLiteContext();
  const [progress, setProgress] = useState<RoutineProgress | null>(null);
  const [dayLogs, setDayLogs] = useState<RoutineDayLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<{ program_key: string | null; day_index: number; week_number: number; started_at: string | null }>(
      'SELECT program_key, day_index, week_number, started_at FROM routine_progress WHERE id = 1'
    );
    setProgress(
      row?.program_key ? { programKey: row.program_key, dayIndex: row.day_index, weekNumber: row.week_number, startedAt: row.started_at ?? '' } : null
    );
    if (row?.program_key) {
      const logs = await db.getAllAsync<{ day_key: string; week_number: number }>(
        'SELECT day_key, week_number FROM routine_day_logs WHERE program_key = ?',
        [row.program_key]
      );
      setDayLogs(logs.map((l) => ({ dayKey: l.day_key, weekNumber: l.week_number })));
    } else {
      setDayLogs([]);
    }
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const startProgram = useCallback(
    async (programKey: string) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO routine_progress (id, program_key, day_index, week_number, started_at, updated_at, sync_id) VALUES (1, ?, 0, 1, ?, ?, 'singleton')
         ON CONFLICT(id) DO UPDATE SET program_key = excluded.program_key, day_index = 0, week_number = 1,
           started_at = excluded.started_at, updated_at = excluded.updated_at,
           sync_id = COALESCE(routine_progress.sync_id, 'singleton')`,
        [programKey, now, now]
      );
      await pushLocalRow(db, 'routine_progress', 1);
      await refresh();
    },
    [db, refresh]
  );

  const completeDay = useCallback(
    async (params: { programKey: string; dayKey: string; weekNumber: number; nextDayIndex: number; nextWeekNumber: number; durationSeconds?: number | null }) => {
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO routine_day_logs (program_key, day_key, week_number, completed_at, duration_seconds, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [params.programKey, params.dayKey, params.weekNumber, now, params.durationSeconds ?? null, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'routine_day_logs', result.lastInsertRowId);
      await db.runAsync('UPDATE routine_progress SET day_index = ?, week_number = ?, updated_at = ? WHERE id = 1', [
        params.nextDayIndex,
        params.nextWeekNumber,
        now,
      ]);
      await pushLocalRow(db, 'routine_progress', 1);
      await refresh();
    },
    [db, refresh]
  );

  return { progress, dayLogs, loading, startProgram, completeDay };
}
