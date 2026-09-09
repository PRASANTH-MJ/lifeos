import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';
import type { Club, ClubCategory, ClubPrivacy } from './types';

/** A single club's live doc, plus whether the signed-in user is a member and join()/leave()
 * actions — same optimistic-flip + callable shape as modules/social/useFollow.ts, for the same
 * reason: joining/leaving needs to atomically update the club's memberCount too, which a client
 * can't safely do to a document it doesn't own. */
export function useClub(clubId: string | null | undefined) {
  const myUid = auth.currentUser?.uid;
  const [club, setClub] = useState<Club | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clubId) {
      setClub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId),
      (snap) => {
        const data = snap.data();
        setClub(
          data
            ? {
                id: clubId,
                name: data.name ?? '',
                description: data.description ?? null,
                // Older club docs predate multi-category — they had one `category` string, so that
                // becomes a single-element array rather than being dropped.
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
              }
            : null
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  useEffect(() => {
    if (!clubId || !myUid) {
      setIsMember(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(firestore, 'clubs', clubId, 'members', myUid),
      (snap) => {
        const exists = snap.exists();
        setIsMember(exists);
        setOptimistic((current) => (current === exists ? null : current));
      },
      () => {}
    );
    return unsubscribe;
  }, [clubId, myUid]);

  const join = async () => {
    if (!clubId) return;
    setOptimistic(true);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string }, { joined: boolean }>(functions, 'joinClub');
      await fn({ clubId });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const leave = async () => {
    if (!clubId) return;
    setOptimistic(false);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string }, { joined: boolean }>(functions, 'leaveClub');
      await fn({ clubId });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // The creator is always treated as a full admin, even on a legacy club doc whose `admins`
  // array doesn't actually list them (e.g. a club created before this field existed) — the rest
  // of the app assumes this invariant holds (setClubAdminRole refuses to ever demote the
  // creator), so this hook and the deleteClub Cloud Function must agree on it too. Matches
  // ClubActivityLeaderboardSection's isAdmin definition, which already does the same thing.
  const isAdmin = !!myUid && !!club && (club.admins.includes(myUid) || club.createdBy === myUid);
  const isSubAdmin = !!myUid && !!club?.subAdmins.includes(myUid);

  return { club, loading, isMember: optimistic ?? isMember, isAdmin, isSubAdmin, canModerate: isAdmin || isSubAdmin, submitting, join, leave };
}
