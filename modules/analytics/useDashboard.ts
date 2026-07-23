import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, buildDailySeries, todayKey } from '@/lib/date';
import { MOODS } from '@/modules/journal';

const DAYS = 14;
const MOOD_SCORE: Record<string, number> = Object.fromEntries(MOODS.map((mood, index) => [mood.key, MOODS.length - index]));

type Series = { date: string; value: number }[];

export type DashboardData = {
  habitsSeries: Series;
  tasksSeries: Series;
  moodSeries: Series;
  wellnessSeries: Series;
  spendSeries: Series;
  caloriesSeries: Series;
  activeHabitsCount: number;
  tasksCompletedTotal: number;
  avgMood: number | null;
  wellnessMinutesTotal: number;
  spendTotal: number;
  avgCaloriesPerDay: number;
  overdueTasksCount: number;
  habitStatusBreakdown: { done: number; fail: number; skip: number };
  moodBreakdown: { label: string; count: number }[];
  mealBreakdown: { meal: string; calories: number }[];
  workoutsCompletedTotal: number;
};

/**
 * Read-only aggregation over every module's own tables — this hook (and the
 * screen that uses it) is the only place in the app that queries across
 * module boundaries. It never writes anything and owns no tables of its own.
 */
export function useAnalyticsDashboard() {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const start = addDays(todayKey(), -(DAYS - 1));

    const [
      habitRows,
      taskRows,
      moodRows,
      meditationRows,
      breathingRows,
      spendRows,
      calorieRows,
      activeHabitsRow,
      overdueTasksRow,
      habitStatusRows,
      mealRows,
      workoutsRow,
    ] = await Promise.all([
        db.getAllAsync<{ date: string; count: number }>(
          "SELECT date, COUNT(*) as count FROM habit_logs WHERE status = 'done' AND date >= ? GROUP BY date",
          [start]
        ),
        db.getAllAsync<{ date: string; count: number }>(
          `SELECT substr(completed_at, 1, 10) as date, COUNT(*) as count FROM tasks
           WHERE completed_at IS NOT NULL AND substr(completed_at, 1, 10) >= ? GROUP BY date`,
          [start]
        ),
        db.getAllAsync<{ date: string; mood: string }>(
          `SELECT substr(created_at, 1, 10) as date, mood FROM journal_entries
           WHERE mood IS NOT NULL AND substr(created_at, 1, 10) >= ?`,
          [start]
        ),
        db.getAllAsync<{ date: string; seconds: number }>(
          `SELECT substr(completed_at, 1, 10) as date, SUM(duration_seconds) as seconds FROM meditation_logs
           WHERE substr(completed_at, 1, 10) >= ? GROUP BY date`,
          [start]
        ),
        db.getAllAsync<{ date: string; seconds: number }>(
          `SELECT substr(completed_at, 1, 10) as date, SUM(duration_seconds) as seconds FROM breathing_logs
           WHERE substr(completed_at, 1, 10) >= ? GROUP BY date`,
          [start]
        ),
        db.getAllAsync<{ date: string; total: number }>(
          "SELECT date, SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? GROUP BY date",
          [start]
        ),
        db.getAllAsync<{ date: string; total: number }>(
          'SELECT date, SUM(calories) as total FROM food_logs WHERE date >= ? GROUP BY date',
          [start]
        ),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM habits WHERE archived = 0'),
        db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM tasks
           WHERE archived = 0 AND is_recurring = 0 AND completed_at IS NULL AND due_date IS NOT NULL AND due_date < ?`,
          [todayKey()]
        ),
        db.getAllAsync<{ status: string; count: number }>(
          'SELECT status, COUNT(*) as count FROM habit_logs WHERE date >= ? GROUP BY status',
          [start]
        ),
        db.getAllAsync<{ meal: string; total: number }>('SELECT meal, SUM(calories) as total FROM food_logs WHERE date >= ? GROUP BY meal', [
          start,
        ]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_logs WHERE substr(completed_at, 1, 10) >= ?', [start]),
      ]);

    const habitsByDate = Object.fromEntries(habitRows.map((row) => [row.date, row.count]));
    const tasksByDate = Object.fromEntries(taskRows.map((row) => [row.date, row.count]));

    const moodTotalsByDate: Record<string, { sum: number; count: number }> = {};
    for (const row of moodRows) {
      const score = MOOD_SCORE[row.mood];
      if (score == null) continue;
      const entry = moodTotalsByDate[row.date] ?? { sum: 0, count: 0 };
      entry.sum += score;
      entry.count += 1;
      moodTotalsByDate[row.date] = entry;
    }
    const moodByDate = Object.fromEntries(
      Object.entries(moodTotalsByDate).map(([date, { sum, count }]) => [date, sum / count])
    );

    const wellnessByDate: Record<string, number> = {};
    for (const row of meditationRows) wellnessByDate[row.date] = (wellnessByDate[row.date] ?? 0) + row.seconds / 60;
    for (const row of breathingRows) wellnessByDate[row.date] = (wellnessByDate[row.date] ?? 0) + row.seconds / 60;

    const spendByDate = Object.fromEntries(spendRows.map((row) => [row.date, row.total]));
    const caloriesByDate = Object.fromEntries(calorieRows.map((row) => [row.date, row.total]));

    const habitsSeries = buildDailySeries(DAYS, habitsByDate);
    const tasksSeries = buildDailySeries(DAYS, tasksByDate);
    const moodSeries = buildDailySeries(DAYS, moodByDate);
    const wellnessSeries = buildDailySeries(DAYS, wellnessByDate);
    const spendSeries = buildDailySeries(DAYS, spendByDate);
    const caloriesSeries = buildDailySeries(DAYS, caloriesByDate);

    const moodEntries = Object.values(moodTotalsByDate);
    const avgMood =
      moodEntries.length > 0
        ? moodEntries.reduce((sum, entry) => sum + entry.sum, 0) / moodEntries.reduce((sum, entry) => sum + entry.count, 0)
        : null;

    const moodCounts: Record<string, number> = {};
    for (const row of moodRows) {
      moodCounts[row.mood] = (moodCounts[row.mood] ?? 0) + 1;
    }
    const moodBreakdown = MOODS.map((mood) => ({ label: mood.label, count: moodCounts[mood.key] ?? 0 })).filter((m) => m.count > 0);

    const habitStatusBreakdown = { done: 0, fail: 0, skip: 0 };
    for (const row of habitStatusRows) {
      if (row.status === 'done' || row.status === 'fail' || row.status === 'skip') {
        habitStatusBreakdown[row.status] = row.count;
      }
    }

    const mealBreakdown = mealRows.map((row) => ({ meal: row.meal, calories: row.total })).sort((a, b) => b.calories - a.calories);

    setData({
      habitsSeries,
      tasksSeries,
      moodSeries,
      wellnessSeries,
      spendSeries,
      caloriesSeries,
      activeHabitsCount: activeHabitsRow?.count ?? 0,
      tasksCompletedTotal: taskRows.reduce((sum, row) => sum + row.count, 0),
      avgMood,
      wellnessMinutesTotal: Math.round(wellnessSeries.reduce((sum, point) => sum + point.value, 0)),
      spendTotal: spendRows.reduce((sum, row) => sum + row.total, 0),
      avgCaloriesPerDay: Math.round(caloriesSeries.reduce((sum, point) => sum + point.value, 0) / DAYS),
      overdueTasksCount: overdueTasksRow?.count ?? 0,
      habitStatusBreakdown,
      moodBreakdown,
      mealBreakdown,
      workoutsCompletedTotal: workoutsRow?.count ?? 0,
    });
    setLoading(false);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

export function nearestMoodLabel(score: number): string {
  const rounded = Math.min(Math.max(Math.round(score), 1), MOODS.length);
  return MOODS[MOODS.length - rounded]?.label ?? '—';
}
