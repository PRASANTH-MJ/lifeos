import { addDays, todayKey } from '@/lib/date';
import type { HabitLog, LogStatus } from './types';

export type RangeKey = 'week' | 'month' | 'year';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function rangeBounds(range: RangeKey, referenceDate: string = todayKey()): { start: string; end: string } {
  if (range === 'week') return { start: addDays(referenceDate, -6), end: referenceDate };
  if (range === 'year') return { start: addDays(referenceDate, -364), end: referenceDate };
  const prefix = referenceDate.slice(0, 7);
  const [year, month] = referenceDate.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return { start: `${prefix}-01`, end: `${prefix}-${String(daysInMonth).padStart(2, '0')}` };
}

export function tallyStatus(logs: { date: string; status: LogStatus }[], start: string, end: string): Record<LogStatus, number> {
  const counts: Record<LogStatus, number> = { done: 0, fail: 0, skip: 0 };
  for (const log of logs) {
    if (log.date >= start && log.date <= end) counts[log.status] += 1;
  }
  return counts;
}

/** Done-count per month for the trailing `monthsBack` months (default 12), oldest first — feeds a yearly bar chart. */
export function monthlyDoneCounts(logs: HabitLog[], monthsBack = 12): { label: string; value: number }[] {
  const today = todayKey();
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const result: { label: string; value: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const total = todayYear * 12 + (todayMonth - 1) - i;
    const year = Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const count = logs.filter((log) => log.date.startsWith(prefix) && log.status === 'done').length;
    result.push({ label: MONTH_SHORT[month], value: count });
  }
  return result;
}

export const STREAK_CHALLENGE_TIERS = [
  { days: 7, label: '7-day streak' },
  { days: 30, label: '30-day streak' },
  { days: 100, label: '100-day streak' },
];
