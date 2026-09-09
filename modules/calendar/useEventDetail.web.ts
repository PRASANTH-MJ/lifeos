import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { CalendarEvent } from './types';

/**
 * Web build of useEventDetail.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write to this event from any tab (or the sync
 * engine's merge) flows straight into every mounted useEventDetail(eventId) instance, so the
 * manual refresh() call after updateEvent is no longer needed to see the change (kept as a
 * no-op-returning function only so callers that awaited it don't need changing).
 */
export function useEventDetail(eventId: number) {
  const event = useLiveQuery(
    () => webDb.calendar_events.get(eventId) as Promise<CalendarEvent | undefined>,
    [eventId]
  );
  const loading = event === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const updateEvent = useCallback(
    async (values: Partial<Pick<CalendarEvent, 'title' | 'notes' | 'start_time' | 'end_time'>>) => {
      await webDb.calendar_events.update(eventId, { ...values, updated_at: new Date().toISOString() });
      await pushLocalRow('calendar_events', eventId);
    },
    [eventId]
  );

  const deleteEvent = useCallback(async () => {
    await recordDeleteBeforeRemoving('calendar_events', eventId);
    await webDb.calendar_events.delete(eventId);
  }, [eventId]);

  return { event: event ?? null, loading, updateEvent, deleteEvent, refresh };
}
