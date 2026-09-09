import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useExerciseCatalog } from './useExerciseCatalog';

// Small muscles recover fastest, large compound-lift muscles slowest — tau is the exponential
// decay time constant derived from a target "back to ~90% recovered" time (tau = hoursTarget /
// ln(10)): 48h target -> ~21h, 72h -> ~31h, 96h -> ~42h. Deliberately crude (ignores load/RPE,
// uses reps as a rough set-quality proxy) — good enough for a personal tracker, not sports science.
const TAU_HOURS: Record<string, number> = {
  Biceps: 21,
  Triceps: 21,
  Brachialis: 21,
  Calves: 21,
  Soleus: 21,
  Abs: 21,
  'Obliquus externus abdominis': 21,
  'Serratus anterior': 21,
  Shoulders: 31,
  Trapezius: 31,
  Hamstrings: 31,
  Chest: 42,
  Lats: 42,
  Quads: 42,
  Glutes: 42,
};
const DEFAULT_TAU_HOURS = 31;
const NORM_CAP = 4.0; // fatigue value a "typical hard session" (~4 primary working sets) produces
const LOOKBACK_DAYS = 10;

export const MUSCLES = Object.keys(TAU_HOURS);

type LogRow = { exercise_key: string; sets: number | null; reps: number | null; created_at: string };

export function useMuscleRecovery() {
  const db = useSQLiteContext();
  const { exercises: catalog } = useExerciseCatalog();
  const [recoveryByMuscle, setRecoveryByMuscle] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<LogRow>(
      `SELECT exercise_key, sets, reps, created_at FROM exercise_logs WHERE created_at >= datetime('now', '-${LOOKBACK_DAYS} days')`
    );
    const now = Date.now();
    const fatigueByMuscle: Record<string, number> = {};

    for (const row of rows) {
      const exercise = catalog.find((e) => e.key === row.exercise_key);
      if (!exercise) continue;
      const hoursAgo = (now - new Date(row.created_at).getTime()) / 36e5;
      if (hoursAgo < 0) continue;
      const setsCount = row.sets ?? 1;
      const repsQuality = Math.min(1, (row.reps ?? 8) / 10);

      const contribute = (muscle: string, roleWeight: number) => {
        const tau = TAU_HOURS[muscle] ?? DEFAULT_TAU_HOURS;
        const decayed = roleWeight * setsCount * repsQuality * Math.exp(-hoursAgo / tau);
        fatigueByMuscle[muscle] = (fatigueByMuscle[muscle] ?? 0) + decayed;
      };
      for (const muscle of exercise.muscles) contribute(muscle, 1.0);
      for (const muscle of exercise.musclesSecondary) contribute(muscle, 0.5);
    }

    const next: Record<string, number> = {};
    for (const muscle of MUSCLES) {
      const fatigue = fatigueByMuscle[muscle] ?? 0;
      next[muscle] = Math.round(100 * (1 - Math.min(1, fatigue / NORM_CAP)));
    }
    setRecoveryByMuscle(next);
    setLoading(false);
  }, [db, catalog]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const overallRecovery = MUSCLES.length
    ? Math.round(MUSCLES.reduce((sum, m) => sum + (recoveryByMuscle[m] ?? 100), 0) / MUSCLES.length)
    : 100;

  return { recoveryByMuscle, overallRecovery, loading, refresh };
}
