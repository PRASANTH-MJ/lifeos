import { addDays, todayKey } from '@/lib/date';

/** Consecutive-day streak across ALL cardio activities combined (a run day and a yoga day both
 * count, same as Strava's own account-wide streak) — deliberately more forgiving than
 * modules/workout/streak.ts's computeWorkoutStreak: if today has no log yet, the streak still
 * counts as long as it reached yesterday, since the day isn't over yet and a user shouldn't see
 * their streak zero out before they've had a chance to log today. */
export function computeCardioStreak(logs: { date: string }[]): number {
  const loggedDates = new Set(logs.map((l) => l.date));
  let cursor = todayKey();
  if (!loggedDates.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!loggedDates.has(cursor)) return 0;
  }
  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
