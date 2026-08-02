import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, todayKey } from '@/lib/date';

import { MOOD_SCORE, WORKOUT_MINUTES } from './useDashboard';

export type PreviousPeriodStats = {
  tasksCompletedTotal: number;
  avgMood: number | null;
  wellnessMinutesTotal: number;
  workoutMinutesTotal: number;
  workoutsCompletedTotal: number;
  missedHabits: number;
  spend: number;
};

/**
 * The same handful of scalar totals `useAnalyticsDashboard` computes, but for the equal-length
 * window immediately *before* the current one — just enough to power MetricGrid's up/down trend
 * arrows without re-running (or duplicating) the full dashboard's series/breakdown queries.
 */
export function usePreviousPeriodStats(days: number) {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<PreviousPeriodStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentStart = addDays(todayKey(), -(days - 1));
      const start = addDays(currentStart, -days);
      const end = addDays(currentStart, -1);

      const [taskRow, moodRows, meditationRow, breathingRow, workoutKeyRows, habitStatusRows, spendRow] = await Promise.all([
        db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM tasks WHERE completed_at IS NOT NULL AND substr(completed_at, 1, 10) BETWEEN ? AND ?`,
          [start, end]
        ),
        db.getAllAsync<{ mood: string }>(
          `SELECT mood FROM journal_entries WHERE mood IS NOT NULL AND substr(created_at, 1, 10) BETWEEN ? AND ?`,
          [start, end]
        ),
        db.getFirstAsync<{ seconds: number | null }>(
          `SELECT SUM(duration_seconds) as seconds FROM meditation_logs WHERE substr(completed_at, 1, 10) BETWEEN ? AND ?`,
          [start, end]
        ),
        db.getFirstAsync<{ seconds: number | null }>(
          `SELECT SUM(duration_seconds) as seconds FROM breathing_logs WHERE substr(completed_at, 1, 10) BETWEEN ? AND ?`,
          [start, end]
        ),
        db.getAllAsync<{ workout_key: string }>(
          `SELECT workout_key FROM workout_logs WHERE substr(completed_at, 1, 10) BETWEEN ? AND ?`,
          [start, end]
        ),
        db.getAllAsync<{ status: string; count: number }>(
          `SELECT status, COUNT(*) as count FROM habit_logs WHERE date BETWEEN ? AND ? GROUP BY status`,
          [start, end]
        ),
        db.getFirstAsync<{ total: number | null }>(
          `SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date BETWEEN ? AND ?`,
          [start, end]
        ),
      ]);

      const moodScores = moodRows.map((row) => MOOD_SCORE[row.mood]).filter((score): score is number => score != null);
      const avgMood = moodScores.length > 0 ? moodScores.reduce((s, v) => s + v, 0) / moodScores.length : null;
      const missedHabits = habitStatusRows.find((row) => row.status === 'fail')?.count ?? 0;
      const workoutMinutesTotal = workoutKeyRows.reduce((s, row) => s + (WORKOUT_MINUTES[row.workout_key] ?? 0), 0);
      const wellnessMinutesTotal = Math.round(((meditationRow?.seconds ?? 0) + (breathingRow?.seconds ?? 0)) / 60);

      setStats({
        tasksCompletedTotal: taskRow?.count ?? 0,
        avgMood,
        wellnessMinutesTotal,
        workoutMinutesTotal,
        workoutsCompletedTotal: workoutKeyRows.length,
        missedHabits,
        spend: spendRow?.total ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { stats, loading, refresh };
}
