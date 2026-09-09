import { addDays, toDateKey, todayKey } from '@/lib/date';

/** Consecutive-day streak ending today, derived from completion timestamps — a run of days, not
 * just a count within the current calendar week (that's `completedThisWeek` in useWorkoutLogs). */
export function computeWorkoutStreak(logs: { completed_at: string }[]): number {
  const completedDates = new Set(logs.map((l) => toDateKey(new Date(l.completed_at))));
  let streak = 0;
  let cursor = todayKey();
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
