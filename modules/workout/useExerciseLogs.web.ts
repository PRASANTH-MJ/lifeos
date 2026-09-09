import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

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
  exerciseKey: string,
  values: { date: string; sets?: number | null; reps?: number | null; weightKg?: number | null; note?: string | null }
) {
  const now = new Date().toISOString();
  const id = await webDb.exercise_logs.add({
    exercise_key: exerciseKey,
    date: values.date,
    sets: values.sets ?? null,
    reps: values.reps ?? null,
    weight_kg: values.weightKg ?? null,
    note: values.note ?? null,
    created_at: now,
    updated_at: now,
    sync_id: Crypto.randomUUID(),
  } as never);
  await pushLocalRow('exercise_logs', id as number);
}

export function useExerciseLogs(exerciseKey: string) {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.exercise_logs.toArray()) as ExerciseLog[];
    return all
      .filter((row) => row.exercise_key === exerciseKey)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1; // date DESC
        return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0; // created_at DESC
      });
  }, [exerciseKey]);

  const loading = rows === undefined;
  const logs = rows ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addLog = useCallback(
    async (values: { date: string; sets?: number | null; reps?: number | null; weightKg?: number | null; note?: string | null }) => {
      await insertExerciseLog(exerciseKey, values);
    },
    [exerciseKey]
  );

  const removeLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('exercise_logs', id);
    await webDb.exercise_logs.delete(id);
  }, []);

  return { logs, loading, addLog, removeLog, refresh };
}
