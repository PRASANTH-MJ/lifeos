import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import type { Club } from './types';
import type { ClubHabit, ClubRecurrence } from './clubProductivityTypes';

function toClubHabit(clubId: string, id: string, data: Record<string, unknown>): ClubHabit {
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    recurrence: (data.recurrence as ClubRecurrence) ?? 'daily',
    targetDays: Array.isArray(data.targetDays) ? (data.targetDays as number[]) : [],
    createdBy: (data.createdBy as string) ?? '',
    archived: (data.archived as boolean) ?? false,
  };
}

/** Every shared habit across every club in `myClubs` (see useMyClubs), for the Productivity tab's
 * cross-club "Club Habits" rollup section. One habits-subcollection listener per club — same
 * one-listener-per-item shape as useMyClubs itself, fine at this app's scale. */
export function useMyClubHabits(myClubs: Club[]) {
  const [habitsByClub, setHabitsByClub] = useState<Record<string, ClubHabit[]>>({});
  const clubIds = myClubs.map((c) => c.id).join(',');

  useEffect(() => {
    if (myClubs.length === 0) {
      setHabitsByClub({});
      return;
    }
    const unsubscribes = myClubs.map((club) =>
      onSnapshot(
        query(collection(firestore, 'clubs', club.id, 'habits'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setHabitsByClub((current) => ({ ...current, [club.id]: snapshot.docs.map((d) => toClubHabit(club.id, d.id, d.data())) }));
        },
        () => {}
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    // clubIds, not myClubs — see useMyClubs.ts's identical reasoning for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubIds]);

  // Archived habits are excluded here — a retired club habit has no business surfacing on the
  // Productivity tab's cross-club rollup, only in the dedicated in-club list's Archived view.
  const habits = myClubs.flatMap((club) => (habitsByClub[club.id] ?? []).filter((h) => !h.archived).map((habit) => ({ habit, club })));
  const loading = myClubs.length > 0 && Object.keys(habitsByClub).length < myClubs.length;
  return { habits, loading };
}
