import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
import type { ClubHabit, ClubRecurrence } from './clubProductivityTypes';

function toClubHabit(clubId: string, id: string, data: Record<string, unknown>): ClubHabit {
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    recurrence: (data.recurrence as ClubRecurrence) ?? 'daily',
    targetDays: Array.isArray(data.targetDays) ? (data.targetDays as number[]) : [],
    createdBy: (data.createdBy as string) ?? '',
  };
}

/** Every shared habit in one club, newest first. */
export function useClubHabits(clubId: string | null | undefined) {
  const [habits, setHabits] = useState<ClubHabit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setHabits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, 'habits'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHabits(snapshot.docs.map((d) => toClubHabit(clubId, d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { habits, loading };
}

/** Creates a club habit — see functions/index.js's createClubHabit for why this needs a callable
 * (a member-only write to a doc the client doesn't own). */
export function useCreateClubHabit() {
  const [submitting, setSubmitting] = useState(false);

  const createClubHabit = async (
    clubId: string,
    values: { title: string; recurrence: ClubRecurrence; targetDays?: number[] }
  ): Promise<string> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<
        { clubId: string; title: string; recurrence: ClubRecurrence; targetDays?: number[] },
        { habitId: string }
      >(functions, 'createClubHabit');
      const result = await fn({ clubId, ...values });
      return result.data.habitId;
    } finally {
      setSubmitting(false);
    }
  };

  return { createClubHabit, submitting };
}

/** Deletes a club habit — creator or club admin/sub-admin only (enforced server-side, see
 * functions/index.js's deleteClubHabit). */
export function useDeleteClubHabit() {
  const [submitting, setSubmitting] = useState(false);

  const deleteClubHabit = async (clubId: string, habitId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; habitId: string }, { deleted: boolean }>(functions, 'deleteClubHabit');
      await fn({ clubId, habitId });
    } finally {
      setSubmitting(false);
    }
  };

  return { deleteClubHabit, submitting };
}
