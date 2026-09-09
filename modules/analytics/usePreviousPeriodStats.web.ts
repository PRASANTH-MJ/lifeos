import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

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

type TaskRow = { completed_at: string | null };
type JournalRow = { mood: string | null; created_at: string };
type MeditationRow = { duration_seconds: number | null; completed_at: string };
type BreathingRow = { duration_seconds: number | null; completed_at: string };
type WorkoutLogRow = { workout_key: string; completed_at: string };
type HabitLogRow = { status: string; date: string };
type FinanceTxRow = { type: string; amount: number; date: string };

function inRange(dateOrTimestamp: string, start: string, end: string): boolean {
  const key = dateOrTimestamp.slice(0, 10);
  return key >= start && key <= end;
}

/**
 * Web build of usePreviousPeriodStats.ts — same PreviousPeriodStats shape, computed reactively
 * via Dexie's useLiveQuery instead of expo-router's useFocusEffect + manual refresh(). Every SQL
 * query in the native version becomes a `.toArray()` read of the relevant table plus a JS
 * filter/reduce over the [start, end] window (these tables are all small, so this has no
 * meaningful performance cost).
 */
export function usePreviousPeriodStats(days: number) {
  const { start, end } = useMemo(() => {
    const currentStart = addDays(todayKey(), -(days - 1));
    const s = addDays(currentStart, -days);
    const e = addDays(currentStart, -1);
    return { start: s, end: e };
  }, [days]);

  const stats = useLiveQuery<PreviousPeriodStats>(async () => {
    const [taskRows, journalRows, meditationRows, breathingRows, workoutLogRows, habitLogRows, financeTxRows] = await Promise.all([
      webDb.tasks.toArray() as unknown as Promise<TaskRow[]>,
      webDb.journal_entries.toArray() as unknown as Promise<JournalRow[]>,
      webDb.meditation_logs.toArray() as unknown as Promise<MeditationRow[]>,
      webDb.breathing_logs.toArray() as unknown as Promise<BreathingRow[]>,
      webDb.workout_logs.toArray() as unknown as Promise<WorkoutLogRow[]>,
      webDb.habit_logs.toArray() as unknown as Promise<HabitLogRow[]>,
      webDb.finance_transactions.toArray() as unknown as Promise<FinanceTxRow[]>,
    ]);

    const tasksCompletedTotal = taskRows.filter(
      (row) => row.completed_at != null && inRange(row.completed_at, start, end)
    ).length;

    const moodScores = journalRows
      .filter((row) => row.mood != null && inRange(row.created_at, start, end))
      .map((row) => MOOD_SCORE[row.mood as string])
      .filter((score): score is number => score != null);
    const avgMood = moodScores.length > 0 ? moodScores.reduce((s, v) => s + v, 0) / moodScores.length : null;

    const meditationSeconds = meditationRows
      .filter((row) => inRange(row.completed_at, start, end))
      .reduce((s, row) => s + (row.duration_seconds ?? 0), 0);
    const breathingSeconds = breathingRows
      .filter((row) => inRange(row.completed_at, start, end))
      .reduce((s, row) => s + (row.duration_seconds ?? 0), 0);
    const wellnessMinutesTotal = Math.round((meditationSeconds + breathingSeconds) / 60);

    const workoutKeyRows = workoutLogRows.filter((row) => inRange(row.completed_at, start, end));
    const workoutMinutesTotal = workoutKeyRows.reduce((s, row) => s + (WORKOUT_MINUTES[row.workout_key] ?? 0), 0);
    const workoutsCompletedTotal = workoutKeyRows.length;

    const habitStatusRowsInRange = habitLogRows.filter((row) => row.date >= start && row.date <= end);
    const missedHabits = habitStatusRowsInRange.filter((row) => row.status === 'fail').length;

    const spend = financeTxRows
      .filter((row) => row.type === 'expense' && row.date >= start && row.date <= end)
      .reduce((s, row) => s + row.amount, 0);

    return {
      tasksCompletedTotal,
      avgMood,
      wellnessMinutesTotal,
      workoutMinutesTotal,
      workoutsCompletedTotal,
      missedHabits,
      spend,
    };
  }, [start, end]);

  const loading = stats === undefined;

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { stats: stats ?? null, loading, refresh };
}
