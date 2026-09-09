import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';
import type { FamilyInvite } from './types';

/** Pending Family plan invites addressed to the signed-in user — surfaced e.g. in Settings or the
 * Premium screen so they can accept/decline via useRespondToFamilyInvite. */
export function usePendingFamilyInvites() {
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setInvites([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(firestore, 'familyInvites'),
      where('invitedUid', '==', uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setInvites(
          snapshot.docs.map((d) => ({
            id: d.id,
            ownerUid: d.data().ownerUid,
            invitedUid: d.data().invitedUid,
            status: d.data().status,
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { invites, loading };
}
