import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
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

/** Every shared task (one-off and recurring alike — see ClubTask.recurrence) in one club, newest
 * first. */
export function useClubTasks(clubId: string | null | undefined) {
  const [tasks, setTasks] = useState<ClubTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTasks(snapshot.docs.map((d) => toClubTask(clubId, d.id, d.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { tasks, loading };
}

/** Creates a club task, one-off or recurring — see functions/index.js's createClubTask. */
export function useCreateClubTask() {
  const [submitting, setSubmitting] = useState(false);

  const createClubTask = async (
    clubId: string,
    values: {
      title: string;
      assignedTo?: string | null;
      dueDate?: string | null;
      recurrence?: ClubRecurrence | null;
      recurrenceDays?: number[];
    }
  ): Promise<string> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<
        { clubId: string; title: string; assignedTo?: string | null; dueDate?: string | null; recurrence?: ClubRecurrence | null; recurrenceDays?: number[] },
        { taskId: string }
      >(functions, 'createClubTask');
      const result = await fn({ clubId, ...values });
      return result.data.taskId;
    } finally {
      setSubmitting(false);
    }
  };

  return { createClubTask, submitting };
}

/** Toggles a ONE-OFF club task's shared completed state (recurring tasks use useClubCheckins
 * instead — see functions/index.js's toggleClubTaskComplete for why the same callable branches on
 * the task's own `recurrence` field server-side). */
export function useToggleClubTask() {
  const [submitting, setSubmitting] = useState(false);

  const toggleClubTask = async (clubId: string, taskId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; taskId: string }, { completed: boolean }>(functions, 'toggleClubTaskComplete');
      await fn({ clubId, taskId });
    } finally {
      setSubmitting(false);
    }
  };

  return { toggleClubTask, submitting };
}

/** Deletes a club task — creator or club admin/sub-admin only (enforced server-side). */
export function useDeleteClubTask() {
  const [submitting, setSubmitting] = useState(false);

  const deleteClubTask = async (clubId: string, taskId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; taskId: string }, { deleted: boolean }>(functions, 'deleteClubTask');
      await fn({ clubId, taskId });
    } finally {
      setSubmitting(false);
    }
  };

  return { deleteClubTask, submitting };
}

/** Archives/unarchives a club task — creator or club admin/sub-admin only (enforced server-side,
 * see functions/index.js's setClubTaskArchived). Same soft-toggle reasoning as
 * useSetClubHabitArchived — most useful right after completing a one-off task. */
export function useSetClubTaskArchived() {
  const [submitting, setSubmitting] = useState(false);

  const setClubTaskArchived = async (clubId: string, taskId: string, archived: boolean): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; taskId: string; archived: boolean }, { archived: boolean }>(functions, 'setClubTaskArchived');
      await fn({ clubId, taskId, archived });
    } finally {
      setSubmitting(false);
    }
  };

  return { setClubTaskArchived, submitting };
}
