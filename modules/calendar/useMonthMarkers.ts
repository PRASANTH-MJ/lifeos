import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

/** Dates within the given month that have an event or a task due — used to draw dots on the month grid. */
export function useMonthMarkers(year: number, month: number) {
  const db = useSQLiteContext();
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;

    (async () => {
      const [eventRows, taskRows] = await Promise.all([
        db.getAllAsync<{ date: string }>('SELECT DISTINCT date FROM calendar_events WHERE date BETWEEN ? AND ?', [
          start,
          end,
        ]),
        db.getAllAsync<{ due_date: string }>(
          'SELECT DISTINCT due_date FROM tasks WHERE due_date BETWEEN ? AND ? AND archived = 0',
          [start, end]
        ),
      ]);
      if (cancelled) return;
      const set = new Set<string>();
      eventRows.forEach((row) => set.add(row.date));
      taskRows.forEach((row) => set.add(row.due_date));
      setMarkedDates(set);
    })();

    return () => {
      cancelled = true;
    };
  }, [db, year, month]);

  return markedDates;
}
