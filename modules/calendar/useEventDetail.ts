import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import type { CalendarEvent } from './types';

export function useEventDetail(eventId: number) {
  const db = useSQLiteContext();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<CalendarEvent>('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
    setEvent(row);
    setLoading(false);
  }, [db, eventId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const updateEvent = useCallback(
    async (values: Partial<Pick<CalendarEvent, 'title' | 'notes' | 'start_time' | 'end_time'>>) => {
      const keys = Object.keys(values) as (keyof typeof values)[];
      const setClause = [...keys.map((key) => `${key} = ?`), 'updated_at = ?'].join(', ');
      await db.runAsync(`UPDATE calendar_events SET ${setClause} WHERE id = ?`, [
        ...keys.map((key) => values[key] as string | null),
        new Date().toISOString(),
        eventId,
      ]);
      await pushLocalRow(db, 'calendar_events', eventId);
      await refresh();
    },
    [db, eventId, refresh]
  );

  const deleteEvent = useCallback(async () => {
    await recordDeleteBeforeRemoving(db, 'calendar_events', eventId);
    await db.runAsync('DELETE FROM calendar_events WHERE id = ?', [eventId]);
  }, [db, eventId]);

  return { event, loading, updateEvent, deleteEvent, refresh };
}
