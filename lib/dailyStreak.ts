import { addDays, todayKey } from './date';

/** Consecutive-day streak ending today, from a plain list of 'YYYY-MM-DD' date keys — the same
 * "did you log something today" pattern modules/workout/streak.ts already uses, generalized so
 * food/water/mindfulness don't each reimplement it. Habits (frequency-aware) and journal (weekly
 * cadence) have their own, deliberately different streak definitions — left as-is. */
export function computeDailyStreak(dateKeys: string[]): number {
  const days = new Set(dateKeys);
  let streak = 0;
  let cursor = todayKey();
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
