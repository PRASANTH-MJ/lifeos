/** All dates in the app are stored/compared as local `YYYY-MM-DD` strings — never Date objects — so streaks and day-grouping aren't sensitive to time-of-day or timezone drift. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** An ISO timestamp for `dateKey` at local noon — used when backdating a log entry to a
 * chosen day where only the date (not a specific time) matters; noon avoids any
 * midnight-boundary timezone edge cases when the date is later re-derived from it. */
export function dateKeyToTimestamp(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

export function addDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function weekdayOf(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDisplayDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Last `days` date keys ending today, each paired with `valuesByDate[date] ?? 0` — dense, so trend charts never have gaps for missing days. */
export function buildDailySeries(days: number, valuesByDate: Record<string, number>): { date: string; value: number }[] {
  const series: { date: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(todayKey(), -i);
    series.push({ date, value: valuesByDate[date] ?? 0 });
  }
  return series;
}

export function monthCursorOf(dateKey: string): { year: number; month: number } {
  const [year, month] = dateKey.split('-').map(Number);
  return { year, month: month - 1 };
}

export function shiftMonth(cursor: { year: number; month: number }, delta: number): { year: number; month: number } {
  const total = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** 6x7 grid of date keys covering `month` (0-indexed) plus its leading/trailing padding days. */
export function buildMonthGrid(year: number, month: number): string[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells: string[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayOffset = i - startWeekday;
    cells.push(toDateKey(new Date(year, month, 1 + dayOffset)));
  }
  return cells;
}
