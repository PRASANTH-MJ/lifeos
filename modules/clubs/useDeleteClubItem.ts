import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Admin-only hard delete of a club event — see functions/index.js's deleteClubEvent for why this
 * needs a callable (firestore.rules' events/{eventId} `allow write: if false` means there's no
 * client-direct delete path, by design: a delete needs a server-side admin check). */
export function useDeleteClubEvent() {
  const [submitting, setSubmitting] = useState(false);

  const deleteEvent = async (clubId: string, eventId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; eventId: string }, { deleted: boolean }>(functions, 'deleteClubEvent');
      await fn({ clubId, eventId });
    } finally {
      setSubmitting(false);
    }
  };

  return { deleteEvent, submitting };
}

/** Admin-only hard delete of a club challenge — see functions/index.js's deleteClubChallenge. */
export function useDeleteClubChallenge() {
  const [submitting, setSubmitting] = useState(false);

  const deleteChallenge = async (clubId: string, challengeId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; challengeId: string }, { deleted: boolean }>(functions, 'deleteClubChallenge');
      await fn({ clubId, challengeId });
    } finally {
      setSubmitting(false);
    }
  };

  return { deleteChallenge, submitting };
}

/** Full-admin-only hard delete of an entire club — see functions/index.js's deleteClub for the
 * cascade scope (members, invites, messages, challenges, events, habits, tasks and all their own
 * subcollections). The single most destructive club action, so the UI that calls this
 * (app/(tabs)/social/clubs/delete-club.tsx) uses a typed-confirmation screen, same pattern as
 * app/delete-account.tsx, rather than a plain alert. */
export function useDeleteClub() {
  const [submitting, setSubmitting] = useState(false);

  const deleteClub = async (clubId: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string }, { deleted: boolean }>(functions, 'deleteClub');
      await fn({ clubId });
    } finally {
      setSubmitting(false);
    }
  };

  return { deleteClub, submitting };
}
