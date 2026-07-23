import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { MindExercise, MindTrainingLog } from './types';

export function useMindTrainingLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<MindTrainingLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<MindTrainingLog>(
      'SELECT * FROM mind_training_logs ORDER BY completed_at DESC LIMIT 200'
    );
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logScore = useCallback(
    async (exerciseKey: string, score: number) => {
      await db.runAsync('INSERT INTO mind_training_logs (exercise_key, score, completed_at) VALUES (?, ?, ?)', [
        exerciseKey,
        score,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const bestScoreFor = useCallback(
    (exercise: MindExercise): number | null => {
      const scores = logs.filter((log) => log.exercise_key === exercise.key).map((log) => log.score);
      if (scores.length === 0) return null;
      return exercise.lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
    },
    [logs]
  );

  return { logs, loading, logScore, bestScoreFor, refresh };
}

export function useBestScores(exercises: MindExercise[]) {
  const { logs, loading } = useMindTrainingLogs();
  return useMemo(() => {
    const best: Record<string, number | null> = {};
    for (const exercise of exercises) {
      const scores = logs.filter((log) => log.exercise_key === exercise.key).map((log) => log.score);
      best[exercise.key] = scores.length === 0 ? null : exercise.lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
    }
    return { best, loading };
  }, [logs, loading, exercises]);
}
