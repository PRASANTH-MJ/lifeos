import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
import type { EventType, FitnessEvent } from './types';

function toEvent(clubId: string, id: string, data: Record<string, unknown>): FitnessEvent {
  const startsAt = data.startsAt as Timestamp | undefined;
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? null,
    startsAtMs: startsAt ? startsAt.toMillis() : 0,
    createdBy: (data.createdBy as string) ?? '',
    attendeeCount: (data.attendeeCount as number) ?? 0,
    recurring: (data.recurring as boolean) ?? false,
    recurrenceDayOfWeek: (data.recurrenceDayOfWeek as number) ?? null,
    eventType: (data.eventType as EventType) ?? 'other',
    capacity: (data.capacity as number) ?? null,
  };
}

/** Every event in one club, soonest-first. */
export function useEvents(clubId: string | null | undefined) {
  const [events, setEvents] = useState<FitnessEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, 'events'), orderBy('startsAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEvents(snapshot.docs.map((d) => toEvent(clubId, d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { events, loading };
}

type CreateEventValues = {
  title: string;
  description: string;
  startsAtMs: number;
  /** When set, the created doc is a weekly "template" instead of a one-off event — see
   * modules/clubs/recurringEvents.ts. `recurrenceDayOfWeek` and `anchorOccurrenceDate` are derived
   * client-side from `startsAtMs`'s local date (via lib/date) rather than recomputed server-side,
   * since the server has no reliable notion of the creator's local timezone. */
  recurring?: boolean;
  recurrenceDayOfWeek?: number;
  anchorOccurrenceDate?: string;
  eventType: EventType;
  /** null = unlimited attendees, matching pre-capacity behavior. */
  capacity: number | null;
};

/** Creates an event (title/description/start time) and auto-RSVPs the creator — see
 * functions/index.js's createEvent for why this needs a callable. */
export function useCreateEvent() {
  const [submitting, setSubmitting] = useState(false);

  const createEvent = async (clubId: string, values: CreateEventValues): Promise<string> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string } & CreateEventValues, { eventId: string }>(functions, 'createEvent');
      const result = await fn({ clubId, ...values });
      return result.data.eventId;
    } finally {
      setSubmitting(false);
    }
  };

  return { createEvent, submitting };
}
