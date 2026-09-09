import { addDays, todayKey, weekdayOf } from '@/lib/date';

/** The next `count` date keys (soonest first, today included) landing on `recurrenceDayOfWeek` —
 * lets a recurring event's list/calendar views compute upcoming occurrences from the one template
 * doc client-side instead of pre-creating a real event doc per week. */
export function nextOccurrenceDates(recurrenceDayOfWeek: number, count: number, fromDateKey: string = todayKey()): string[] {
  let cursor = fromDateKey;
  while (weekdayOf(cursor) !== recurrenceDayOfWeek) {
    cursor = addDays(cursor, 1);
  }
  const dates: string[] = [];
  for (let i = 0; i < count; i += 1) {
    dates.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return dates;
}
