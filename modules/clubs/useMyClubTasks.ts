import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import type { Club } from './types';
import type { ClubRecurrence, ClubTask } from './clubProductivityTypes';

function toClubTask(clubId: string, id: string, data: Record<string, unknown>): ClubTask {
  const completedAt = data.completedAt as Timestamp | undefined;
  return {
    id,
    clubId,
    title: (data.title as string) ?? '',
    assignedTo: (data.assignedTo as string) ?? null,
    dueDate: (data.dueDate as string) ?? null,
    recurrence: (data.recurrence as ClubRecurrence) ?? null,
    recurrenceDays: Array.isArray(data.recurrenceDays) ? (data.recurrenceDays as number[]) : [],
    createdBy: (data.createdBy as string) ?? '',
    completed: (data.completed as boolean) ?? false,
    completedBy: (data.completedBy as string) ?? null,
    completedAtMs: completedAt ? completedAt.toMillis() : null,
    archived: (data.archived as boolean) ?? false,
  };
}

/** Every shared task across every club in `myClubs`, for the Productivity tab's cross-club "Club
 * Tasks" rollup section — same shape as useMyClubHabits above. */
export function useMyClubTasks(myClubs: Club[]) {
  const [tasksByClub, setTasksByClub] = useState<Record<string, ClubTask[]>>({});
  const clubIds = myClubs.map((c) => c.id).join(',');

  useEffect(() => {
    if (myClubs.length === 0) {
      setTasksByClub({});
      return;
    }
    const unsubscribes = myClubs.map((club) =>
      onSnapshot(
        query(collection(firestore, 'clubs', club.id, 'tasks'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setTasksByClub((current) => ({ ...current, [club.id]: snapshot.docs.map((d) => toClubTask(club.id, d.id, d.data())) }));
        },
        () => {}
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubIds]);

  // Archived tasks excluded — same reasoning as useMyClubHabits' identical filter above.
  const tasks = myClubs.flatMap((club) => (tasksByClub[club.id] ?? []).filter((t) => !t.archived).map((task) => ({ task, club })));
  const loading = myClubs.length > 0 && Object.keys(tasksByClub).length < myClubs.length;
  return { tasks, loading };
}
