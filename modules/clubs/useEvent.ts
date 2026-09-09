import { Timestamp, collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';
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

/** A recurring event's attendee doc id — composite so each week's RSVP is its own doc rather than
 * one doc per uid, since a recurring template has no single "the" occurrence to RSVP to. Plain
 * (non-recurring) events keep the original uid-only doc id, unchanged from before recurrence
 * existed. */
function attendeeDocId(uid: string, occurrenceDate: string | null): string {
  return occurrenceDate ? `${uid}_${occurrenceDate}` : uid;
}

/** A single event's live doc, plus whether the signed-in user has RSVP'd and join()/leave()
 * actions — same optimistic-flip + callable shape as modules/clubs/useClub.ts's isMember/join/leave.
 * `occurrenceDate` (a lib/date dateKey) is required for a recurring event's template doc — RSVPs
 * there are tracked per-occurrence, not once for the whole series — and ignored for a plain event. */
export function useEvent(clubId: string | null | undefined, eventId: string | null | undefined, occurrenceDate: string | null = null) {
  const myUid = auth.currentUser?.uid;
  const [event, setEvent] = useState<FitnessEvent | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // 1-based position among everyone still waiting, or null when not on the waitlist at all — see
  // joinEvent's capacity check (only enforced for a plain, non-recurring event, hence no
  // occurrenceDate scoping here the way attendeeDocId needs it).
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!clubId || !eventId) {
      setEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId, 'events', eventId),
      (snap) => {
        const data = snap.data();
        setEvent(data ? toEvent(clubId, eventId, data) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId, eventId]);

  useEffect(() => {
    if (!clubId || !eventId || !myUid) {
      setHasJoined(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId, 'events', eventId, 'attendees', attendeeDocId(myUid, occurrenceDate)),
      (snap) => {
        const exists = snap.exists();
        setHasJoined(exists);
        setOptimistic((current) => (current === exists ? null : current));
      },
      () => {}
    );
    return unsubscribe;
  }, [clubId, eventId, myUid, occurrenceDate]);

  // Waitlist is only ever populated for a plain event (see joinEvent), so this doesn't need
  // occurrenceDate scoping the way the attendee/hasJoined listener above does.
  useEffect(() => {
    if (!clubId || !eventId || !myUid || occurrenceDate) {
      setWaitlistPosition(null);
      return;
    }
    const q = query(collection(firestore, 'clubs', clubId, 'events', eventId, 'waitlist'), orderBy('joinedAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const index = snapshot.docs.findIndex((d) => d.id === myUid);
        setWaitlistPosition(index >= 0 ? index + 1 : null);
      },
      () => {}
    );
    return unsubscribe;
  }, [clubId, eventId, myUid, occurrenceDate]);

  const join = async () => {
    if (!clubId || !eventId) return;
    setOptimistic(true);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; eventId: string; occurrenceDate?: string }, { joined: boolean; waitlisted?: boolean }>(
        functions,
        'joinEvent'
      );
      const result = await fn({ clubId, eventId, ...(occurrenceDate ? { occurrenceDate } : {}) });
      // A waitlisted RSVP never actually joined `attendees` — don't optimistically flip hasJoined
      // true for it; the waitlistPosition listener above picks up the real state instead.
      if (result.data.waitlisted) setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const leave = async () => {
    if (!clubId || !eventId) return;
    setOptimistic(false);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; eventId: string; occurrenceDate?: string }, { joined: boolean }>(functions, 'leaveEvent');
      await fn({ clubId, eventId, ...(occurrenceDate ? { occurrenceDate } : {}) });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { event, loading, hasJoined: optimistic ?? hasJoined, waitlistPosition, submitting, join, leave };
}

/** Every attendee's uid for one event (or, for a recurring template, one occurrence date) — the
 * roster screen pairs this with usePublicProfile per uid. */
export function useEventAttendees(clubId: string | null | undefined, eventId: string | null | undefined, occurrenceDate: string | null = null) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId || !eventId) {
      setUids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'clubs', clubId, 'events', eventId, 'attendees'),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ uid: (d.data().uid as string) ?? d.id, occurrenceDate: (d.data().occurrenceDate as string) ?? null }));
        setUids(occurrenceDate ? rows.filter((r) => r.occurrenceDate === occurrenceDate).map((r) => r.uid) : rows.map((r) => r.uid));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId, eventId, occurrenceDate]);

  return { uids, loading };
}
