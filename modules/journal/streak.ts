import { addDays, weekdayOf } from '@/lib/date';

function weekStartOf(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey));
}

/** Consecutive weeks (Sun–Sat) with at least one journal entry, walking backward from the
 * current week. The current week gets a grace period — if it has no entry yet, it's simply
 * skipped rather than breaking the streak, since the week isn't over yet (same convention as
 * the daily habit streak). */
export function computeWeeklyStreak(entryDateKeys: string[], todayDateKey: string): number {
  const weeksWithEntries = new Set(entryDateKeys.map(weekStartOf));
  let cursor = weekStartOf(todayDateKey);
  if (!weeksWithEntries.has(cursor)) {
    cursor = addDays(cursor, -7);
  }

  let streak = 0;
  const MAX_LOOKBACK_WEEKS = 520;
  for (let i = 0; i < MAX_LOOKBACK_WEEKS; i += 1) {
    if (!weeksWithEntries.has(cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}
