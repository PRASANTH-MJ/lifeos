import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';
import type { Family } from './types';

/** Live view of the signed-in user's OWN Family plan (they're the subscriber/owner) — null if
 * they don't have one. Members don't read this directly; see useMyFamilyMembership for the
 * "am I on someone else's Family plan" side, which is what a non-owner member needs. */
export function useOwnedFamily() {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setFamily(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'families', uid),
      (snap) => {
        const data = snap.data();
        setFamily(
          data
            ? {
                ownerUid: data.ownerUid,
                plan: data.plan,
                subscriptionStatus: data.subscriptionStatus,
                maxMembers: data.maxMembers ?? 5,
                memberUids: data.memberUids ?? [],
              }
            : null
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { family, loading };
}

/** Whether the signed-in user is riding on someone ELSE's Family plan (as an invited member, not
 * the subscriber) — reads the same premiumSource/familyId fields functions/index.js's applyGrant
 * and respondToFamilyInvite write onto users/{uid}. Null familyId/ownerUid means "not a member of
 * any family". */
export function useMyFamilyMembership() {
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setOwnerUid(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'users', uid),
      (snap) => {
        const data = snap.data();
        setOwnerUid(data?.premiumSource === 'family' && data?.familyId ? (data.familyId as string) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { ownerUid, loading };
}
