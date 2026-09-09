import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { dateKeyToTimestamp } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { MindExercise, MindTrainingLog } from './types';

/**
 * Web build of useMindTrainingLogs.ts — same exported shape. Reactive via useLiveQuery instead
 * of the native version's useFocusEffect-driven refresh(); every open tab's `logs` updates the
 * instant any tab (or the sync engine's merge) writes to mind_training_logs. `refresh` is kept
 * as a no-op-returning function only so ported callers that `await refresh()` don't need changing.
 */
export function useMindTrainingLogs() {
  const logs = useLiveQuery(async () => {
    const all = (await webDb.mind_training_logs.toArray()) as MindTrainingLog[];
    // ORDER BY completed_at DESC LIMIT 200
    return [...all]
      .sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : 0))
      .slice(0, 200);
  }, []);

  const loading = logs === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const logScore = useCallback(async (exerciseKey: string, score: number, dateKey?: string) => {
    const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
    const id = await webDb.mind_training_logs.add({
      exercise_key: exerciseKey,
      score,
      completed_at: completedAt,
      sync_id: Crypto.randomUUID(),
      updated_at: completedAt,
    } as never);
    await pushLocalRow('mind_training_logs', id as number);
  }, []);

  const bestScoreFor = useCallback(
    (exercise: MindExercise): number | null => {
      const scores = (logs ?? [])
        .filter((log) => log.exercise_key === exercise.key)
        .map((log) => log.score);
      if (scores.length === 0) return null;
      return exercise.lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
    },
    [logs]
  );

  return { logs: logs ?? [], loading, logScore, bestScoreFor, refresh };
}

export function useBestScores(exercises: MindExercise[]) {
  const { logs, loading, refresh } = useMindTrainingLogs();
  const best = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const exercise of exercises) {
      const scores = logs.filter((log) => log.exercise_key === exercise.key).map((log) => log.score);
      result[exercise.key] = scores.length === 0 ? null : exercise.lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
    }
    return result;
  }, [logs, exercises]);
  return { best, loading, refresh };
}
