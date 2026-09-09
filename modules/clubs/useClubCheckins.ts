import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';
import { todayKey } from '@/lib/date';
import { computeStreak, isDueToday } from '@/modules/habits';
import type { ClubRecurrence } from './clubProductivityTypes';

/** Shared by club habits and recurring club tasks — both use the identical
 * `.../checkins/{uid}_{dateKey}` subcollection shape (see functions/index.js's
 * toggleClubHabitCheckin/toggleClubTaskComplete). `parent` picks which callable/subcollection to
 * hit. Returns the signed-in member's own done-dates (live), a `computeStreak`-derived streak
 * (reusing modules/habits' exact streak math so a club habit's streak means the same thing a
 * personal habit's does), and a toggle for today. */
export function useClubCheckins(
  parent: 'habits' | 'tasks',
  clubId: string | null | undefined,
  itemId: string | null | undefined,
  recurrence: ClubRecurrence | null,
  targetDays: number[]
) {
  const myUid = auth.currentUser?.uid;
  const [doneDates, setDoneDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clubId || !itemId || !myUid) {
      setDoneDates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, parent, itemId, 'checkins'), where('uid', '==', myUid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setDoneDates(snapshot.docs.map((d) => (d.data().dateKey as string) ?? d.id.split('_').slice(1).join('_')));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [parent, clubId, itemId, myUid]);

  const today = todayKey();
  const doneToday = doneDates.includes(today);
  const streak = recurrence ? computeStreak(doneDates.map((date) => ({ date, status: 'done' as const })), recurrence, targetDays) : 0;
  const dueToday = recurrence ? isDueToday(recurrence, targetDays) : true;

  const toggleToday = async (dateKey: string = today): Promise<void> => {
    if (!clubId || !itemId) return;
    setSubmitting(true);
    try {
      const fnName = parent === 'habits' ? 'toggleClubHabitCheckin' : 'toggleClubTaskComplete';
      const argKey = parent === 'habits' ? 'habitId' : 'taskId';
      const fn = httpsCallable<Record<string, string>, { checked?: boolean; completed?: boolean }>(functions, fnName);
      await fn({ clubId, [argKey]: itemId, dateKey });
    } finally {
      setSubmitting(false);
    }
  };

  return { doneDates, doneToday, streak, dueToday, loading, submitting, toggleToday };
}

/** Every OTHER member's own live checkin document only shows the signed-in viewer's done-dates
 * (see useClubCheckins above — its query is scoped `where('uid', '==', myUid)`), so there was
 * previously no way for a club habit/task row to show who ELSE on the team has done it today.
 * This is the "who's done this today" counterpart: a live query on the same `checkins`
 * subcollection, scoped instead to today's dateKey across every member. Deliberately its own
 * separate hook (not folded into useClubCheckins above) so the compact hub rollup — which must
 * stay lightweight per-row — can skip it entirely; only the dedicated club habits/tasks screens'
 * expandable "who's done" row mounts this. */
export function useClubItemDoneToday(
  parent: 'habits' | 'tasks',
  clubId: string | null | undefined,
  itemId: string | null | undefined
) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId || !itemId) {
      setUids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, parent, itemId, 'checkins'), where('dateKey', '==', todayKey()));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUids(snapshot.docs.map((d) => (d.data().uid as string) ?? d.id.split('_')[0]));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [parent, clubId, itemId]);

  return { uids, loading };
}
