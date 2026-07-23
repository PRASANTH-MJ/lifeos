import { addDays, todayKey, weekdayOf } from '@/lib/date';
import type { HabitFrequency, LogStatus } from './types';

export function isDue(dateKey: string, frequency: HabitFrequency, targetDays: number[]): boolean {
  if (frequency === 'daily' || frequency === 'periodic') return true;
  if (frequency === 'weekly') return targetDays.includes(weekdayOf(dateKey));
  if (frequency === 'monthly') return targetDays.includes(Number(dateKey.split('-')[2]));
  return false;
}

export function isDueToday(frequency: HabitFrequency, targetDays: number[]): boolean {
  return isDue(todayKey(), frequency, targetDays);
}

/**
 * Streak = consecutive due days with status 'done', walking backward from
 * today. 'skip' days don't count toward the streak but don't break it
 * either — they're excluded, not failed. 'fail' (explicit or a due day with
 * no log at all) breaks it. Meaningless for 'periodic' habits (no fixed due
 * day) — use `computePeriodProgress` for those instead.
 */
export function computeStreak(logs: { date: string; status: LogStatus }[], frequency: HabitFrequency, targetDays: number[]): number {
  if (frequency === 'periodic') return 0;

  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));
  const today = todayKey();

  let cursor = today;
  const todayStatus = statusByDate.get(today);
  if (isDue(today, frequency, targetDays) && todayStatus !== 'done') {
    cursor = addDays(today, -1);
  }

  let streak = 0;
  const MAX_LOOKBACK_DAYS = 3650;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i += 1) {
    if (isDue(cursor, frequency, targetDays)) {
      const status = statusByDate.get(cursor);
      if (status === 'done') {
        streak += 1;
      } else if (status === 'skip') {
        // excluded from the count, but doesn't break the streak — keep walking
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** For 'periodic' habits: how many 'done' days fall in the rolling window ending today. */
export function computePeriodProgress(doneDates: string[], periodLengthDays: number): number {
  const start = addDays(todayKey(), -(periodLengthDays - 1));
  return doneDates.filter((date) => date >= start).length;
}

/**
 * Longest streak ever achieved (not just the current one) — same due-day-aware
 * walk as `computeStreak`, but anchored at every 'done' date in history rather
 * than just today, since there's no precomputed "longest streak" column.
 * Used to unlock streak-challenge badges even after a streak has since broken.
 */
export function computeLongestStreak(logs: { date: string; status: LogStatus }[], frequency: HabitFrequency, targetDays: number[]): number {
  if (frequency === 'periodic') return 0;

  const statusByDate = new Map(logs.map((log) => [log.date, log.status]));
  const doneDates = logs.filter((log) => log.status === 'done').map((log) => log.date);

  let longest = 0;
  for (const endDate of doneDates) {
    let streak = 0;
    let cursor = endDate;
    for (let i = 0; i < 3650; i += 1) {
      if (isDue(cursor, frequency, targetDays)) {
        const status = statusByDate.get(cursor);
        if (status === 'done') {
          streak += 1;
        } else if (status === 'skip') {
          // excluded, doesn't break the streak
        } else {
          break;
        }
      }
      cursor = addDays(cursor, -1);
    }
    longest = Math.max(longest, streak);
  }
  return longest;
}
