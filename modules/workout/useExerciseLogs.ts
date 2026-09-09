import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

export type ExerciseLog = {
  id: number;
  exercise_key: string;
  date: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  note: string | null;
  created_at: string;
};

/** Plain (non-hook) insert so callers that write logs for MULTIPLE exercise keys in one go (e.g.
 * finishing a live session with several exercises) can call this directly in a loop, rather than
 * being unable to call a hook conditionally per array item. useExerciseLogs's own addLog below
 * calls this too, so there's one write path, not two. */
export async function insertExerciseLog(
  db: SQLiteDatabase,
  exerciseKey: string,
  values: { date: string; sets?: number | null; reps?: number | null; weightKg?: number | null; note?: string | null }
) {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO exercise_logs (exercise_key, date, sets, reps, weight_kg, note, created_at, updated_at, sync_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [exerciseKey, values.date, values.sets ?? null, values.reps ?? null, values.weightKg ?? null, values.note ?? null, now, now, Crypto.randomUUID()]
  );
  await pushLocalRow(db, 'exercise_logs', result.lastInsertRowId);
}

export function useExerciseLogs(exerciseKey: string) {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<ExerciseLog>(
      'SELECT * FROM exercise_logs WHERE exercise_key = ? ORDER BY date DESC, created_at DESC',
      [exerciseKey]
    );
    setLogs(rows);
    setLoading(false);
  }, [db, exerciseKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addLog = useCallback(
    async (values: { date: string; sets?: number | null; reps?: number | null; weightKg?: number | null; note?: string | null }) => {
      await insertExerciseLog(db, exerciseKey, values);
      await refresh();
    },
    [db, exerciseKey, refresh]
  );

  const removeLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'exercise_logs', id);
      await db.runAsync('DELETE FROM exercise_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  return { logs, loading, addLog, removeLog, refresh };
}
