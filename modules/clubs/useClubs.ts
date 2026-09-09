import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
import type { Club, ClubCategory, ClubPrivacy } from './types';

/** Discover/list every club, most-members-first. Clubs are read-restricted by privacy (see
 * firestore.rules): a 'private' club a signed-in caller isn't a member/invitee of just never
 * comes back in this query's results, so no client-side filtering is needed to keep it out of
 * discovery — the rule already enforces that, not just the UI. */
export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(firestore, 'clubs'), orderBy('memberCount', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setClubs(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name ?? '',
              description: data.description ?? null,
              categories:
                Array.isArray(data.categories) && data.categories.length > 0
                  ? (data.categories as ClubCategory[])
                  : [(data.category as ClubCategory) ?? 'general'],
              photoUrl: data.photoUrl ?? null,
              memberCount: data.memberCount ?? 0,
              createdBy: data.createdBy ?? '',
              admins: data.admins ?? [],
              subAdmins: data.subAdmins ?? [],
              privacy: (data.privacy as ClubPrivacy) ?? 'public',
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { clubs, loading };
}

/** Creates a club (name + optional description + 1-3 categories + privacy level) and auto-joins
 * the creator — see functions/index.js's createClub for why this needs a callable (it pairs the
 * club doc with the creator's own membership doc in one transaction, and re-validates categories/
 * privacy server-side rather than trusting the client). */
export function useCreateClub() {
  const [submitting, setSubmitting] = useState(false);

  const createClub = async (name: string, description: string, categories: ClubCategory[], privacy: ClubPrivacy): Promise<string> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ name: string; description: string; categories: ClubCategory[]; privacy: ClubPrivacy }, { clubId: string }>(
        functions,
        'createClub'
      );
      const result = await fn({ name, description, categories, privacy });
      return result.data.clubId;
    } finally {
      setSubmitting(false);
    }
  };

  return { createClub, submitting };
}
