import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, buildDailySeries, todayKey } from '@/lib/date';
import { MOODS } from '@/modules/journal';
import { WORKOUTS } from '@/modules/workout';

export const WORKOUT_MINUTES: Record<string, number> = Object.fromEntries(WORKOUTS.map((workout) => [workout.key, workout.minutes]));
export const MOOD_SCORE: Record<string, number> = Object.fromEntries(MOODS.map((mood, index) => [mood.key, MOODS.length - index]));

type Series = { date: string; value: number }[];

export type DashboardData = {
  habitsSeries: Series;
  tasksSeries: Series;
  moodSeries: Series;
  wellnessSeries: Series;
  caloriesSeries: Series;
  proteinSeries: Series;
  activeHabitsCount: number;
  tasksCompletedTotal: number;
  avgMood: number | null;
  wellnessMinutesTotal: number;
  overdueTasksCount: number;
  habitStatusBreakdown: { done: number; fail: number; skip: number };
  moodBreakdown: { label: string; count: number }[];
  mealBreakdown: { meal: string; calories: number }[];
  workoutsCompletedTotal: number;
  workoutMinutesTotal: number;
};

/** substr(col, 1, 10) equivalent — first 10 chars of an ISO timestamp string ("YYYY-MM-DD"). */
function dateKeyOf(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

/**
 * Web build of useDashboard.ts — same read-only cross-module aggregation, same exported shape.
 * All of it happens inside a single useLiveQuery callback (rather than useLocalTable per table)
 * because this hook never writes and its "queries" are GROUP BY/JOIN-shaped aggregations with no
 * per-table filter/sort mapping onto useLocalTable's QueryOptions — plain Dexie table reads
 * combined with the exact same JS reduction the native SQL GROUP BY rows produced. useLiveQuery
 * re-runs the whole computation whenever any of the read tables changes in any tab, superseding
 * the native version's useFocusEffect-triggered refresh.
 */
export function useAnalyticsDashboard(days: number = 14) {
  // useLiveQuery only re-runs when a watched table mutates, never on wall-clock time alone.
  // Native recomputes `start`/`today` on every screen focus via useFocusEffect, which also
  // catches a day-boundary crossing with zero writes in between (e.g. the tab stays open
  // overnight). Re-checking todayKey() periodically and on tab-visibility regain replicates
  // that, forcing a recompute even without a new write.
  const [dayTick, setDayTick] = useState(todayKey());
  useEffect(() => {
    const check = () => setDayTick((current) => (current !== todayKey() ? todayKey() : current));
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const data = useLiveQuery(async (): Promise<DashboardData> => {
    const start = addDays(todayKey(), -(days - 1));
    const today = todayKey();

    const [
      allHabitLogs,
      allTasks,
      allJournalEntries,
      allMeditationLogs,
      allBreathingLogs,
      allFoodLogs,
      allHabits,
      allWorkoutLogs,
    ] = await Promise.all([
      webDb.habit_logs.toArray(),
      webDb.tasks.toArray(),
      webDb.journal_entries.toArray(),
      webDb.meditation_logs.toArray(),
      webDb.breathing_logs.toArray(),
      webDb.food_logs.toArray(),
      webDb.habits.toArray(),
      webDb.workout_logs.toArray(),
    ]);

    // SELECT date, COUNT(*) FROM habit_logs WHERE status = 'done' AND date >= ? GROUP BY date
    const habitsByDate: Record<string, number> = {};
    for (const row of allHabitLogs) {
      const date = row.date as string;
      if (row.status !== 'done' || !date || date < start) continue;
      habitsByDate[date] = (habitsByDate[date] ?? 0) + 1;
    }

    // SELECT substr(completed_at,1,10) as date, COUNT(*) FROM tasks WHERE completed_at IS NOT NULL
    // AND substr(completed_at,1,10) >= ? GROUP BY date
    const tasksByDate: Record<string, number> = {};
    let tasksCompletedTotal = 0;
    for (const row of allTasks) {
      if (row.completed_at == null) continue;
      const date = dateKeyOf(row.completed_at);
      if (!date || date < start) continue;
      tasksByDate[date] = (tasksByDate[date] ?? 0) + 1;
      tasksCompletedTotal += 1;
    }

    // SELECT substr(created_at,1,10) as date, mood FROM journal_entries
    // WHERE mood IS NOT NULL AND substr(created_at,1,10) >= ?
    const moodRows: { date: string; mood: string }[] = [];
    for (const row of allJournalEntries) {
      if (row.mood == null) continue;
      const date = dateKeyOf(row.created_at);
      if (!date || date < start) continue;
      moodRows.push({ date, mood: row.mood as string });
    }

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

    // SELECT substr(completed_at,1,10) as date, SUM(duration_seconds) FROM meditation_logs/breathing_logs
    // WHERE substr(completed_at,1,10) >= ? GROUP BY date
    const wellnessByDate: Record<string, number> = {};
    for (const row of allMeditationLogs) {
      const date = dateKeyOf(row.completed_at);
      if (!date || date < start) continue;
      wellnessByDate[date] = (wellnessByDate[date] ?? 0) + (Number(row.duration_seconds) || 0) / 60;
    }
    for (const row of allBreathingLogs) {
      const date = dateKeyOf(row.completed_at);
      if (!date || date < start) continue;
      wellnessByDate[date] = (wellnessByDate[date] ?? 0) + (Number(row.duration_seconds) || 0) / 60;
    }

    // SELECT date, SUM(calories)/SUM(protein_g) FROM food_logs WHERE date >= ? GROUP BY date
    // and SELECT meal, SUM(calories) FROM food_logs WHERE date >= ? GROUP BY meal
    const caloriesByDate: Record<string, number> = {};
    const proteinByDate: Record<string, number> = {};
    const mealTotals: Record<string, number> = {};
    for (const row of allFoodLogs) {
      const date = row.date as string;
      if (!date || date < start) continue;
      caloriesByDate[date] = (caloriesByDate[date] ?? 0) + (Number(row.calories) || 0);
      proteinByDate[date] = (proteinByDate[date] ?? 0) + (Number(row.protein_g) || 0);
      const meal = row.meal as string;
      mealTotals[meal] = (mealTotals[meal] ?? 0) + (Number(row.calories) || 0);
    }

    const habitsSeries = buildDailySeries(days, habitsByDate);
    const tasksSeries = buildDailySeries(days, tasksByDate);
    const moodSeries = buildDailySeries(days, moodByDate);
    const wellnessSeries = buildDailySeries(days, wellnessByDate);
    const caloriesSeries = buildDailySeries(days, caloriesByDate);
    const proteinSeries = buildDailySeries(days, proteinByDate);

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

    // SELECT COUNT(*) FROM habits WHERE archived = 0
    const activeHabitsCount = allHabits.filter((row) => !row.archived).length;

    // SELECT COUNT(*) FROM tasks WHERE archived = 0 AND is_recurring = 0 AND completed_at IS NULL
    // AND due_date IS NOT NULL AND due_date < ?
    const overdueTasksCount = allTasks.filter(
      (row) =>
        !row.archived &&
        !row.is_recurring &&
        row.completed_at == null &&
        row.due_date != null &&
        (row.due_date as string) < today
    ).length;

    // SELECT status, COUNT(*) FROM habit_logs WHERE date >= ? GROUP BY status
    const habitStatusBreakdown = { done: 0, fail: 0, skip: 0 };
    for (const row of allHabitLogs) {
      const date = row.date as string;
      if (!date || date < start) continue;
      const status = row.status as string;
      if (status === 'done' || status === 'fail' || status === 'skip') {
        habitStatusBreakdown[status] += 1;
      }
    }

    const mealBreakdown = Object.entries(mealTotals)
      .map(([meal, calories]) => ({ meal, calories }))
      .sort((a, b) => b.calories - a.calories);

    // SELECT COUNT(*) FROM workout_logs WHERE substr(completed_at,1,10) >= ?
    // and SELECT workout_key FROM workout_logs WHERE substr(completed_at,1,10) >= ?
    const filteredWorkoutLogs = allWorkoutLogs.filter((row) => {
      const date = dateKeyOf(row.completed_at);
      return date && date >= start;
    });
    const workoutsCompletedTotal = filteredWorkoutLogs.length;
    const workoutMinutesTotal = filteredWorkoutLogs.reduce(
      (sum, row) => sum + (WORKOUT_MINUTES[row.workout_key as string] ?? 0),
      0
    );

    return {
      habitsSeries,
      tasksSeries,
      moodSeries,
      wellnessSeries,
      caloriesSeries,
      proteinSeries,
      activeHabitsCount,
      tasksCompletedTotal,
      avgMood,
      wellnessMinutesTotal: Math.round(wellnessSeries.reduce((sum, point) => sum + point.value, 0)),
      overdueTasksCount,
      habitStatusBreakdown,
      moodBreakdown,
      mealBreakdown,
      workoutsCompletedTotal,
      workoutMinutesTotal,
    };
  }, [days, dayTick]);

  const loading = data === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write to the read tables, across
    // every tab. Kept so callers that do `await refresh()` (mirroring the native pull-to-refresh
    // pattern) don't need changing.
  }, []);

  return { data: data ?? null, loading, refresh };
}

export function nearestMoodLabel(score: number): string {
  const rounded = Math.min(Math.max(Math.round(score), 1), MOODS.length);
  return MOODS[MOODS.length - rounded]?.label ?? '—';
}
