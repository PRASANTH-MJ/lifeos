import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

/**
 * Web build of useMonthMarkers.ts — same return shape (a Set<string> of marked dates).
 * Reactive via Dexie's useLiveQuery instead of a one-shot effect: a write to calendar_events
 * or tasks in any tab (or applied by the sync engine's merge) re-runs this query and updates
 * every mounted month grid automatically.
 */
export function useMonthMarkers(year: number, month: number): Set<string> {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;

  const markedDates = useLiveQuery(async () => {
    const [eventRows, taskRows] = await Promise.all([
      webDb.calendar_events.toArray() as unknown as Promise<{ date: string }[]>,
      webDb.tasks.toArray() as unknown as Promise<{ due_date: string; archived: number }[]>,
    ]);

    const set = new Set<string>();
    eventRows.forEach((row) => {
      if (row.date >= start && row.date <= end) set.add(row.date);
    });
    taskRows.forEach((row) => {
      if (row.due_date >= start && row.due_date <= end && !row.archived) set.add(row.due_date);
    });
    return set;
  }, [year, month]);

  return markedDates ?? new Set<string>();
}
