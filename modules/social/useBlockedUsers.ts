import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

/** The signed-in user's own block list (`users/{me}/blocks/{blockedUid}`) — owner-direct-write,
 * same shape as `users/{uid}/records/{recordId}`, since this is purely the viewer's own
 * preference, not a cross-user counter. Firestore can't express "exclude these N uids" inside a
 * single query beyond a reasonable array size, so useFeed filters `snapshot.docs` against this
 * locally-cached set client-side rather than trying to query around it server-side. */
export function useBlockedUsers() {
  const myUid = auth.currentUser?.uid;
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setBlockedUids(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'users', myUid, 'blocks'),
      (snapshot) => {
        setBlockedUids(new Set(snapshot.docs.map((d) => d.id)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [myUid]);

  const blockUser = async (targetUid: string) => {
    if (!myUid) return;
    await setDoc(doc(firestore, 'users', myUid, 'blocks', targetUid), { blockedUid: targetUid, createdAt: serverTimestamp() });
  };

  const unblockUser = async (targetUid: string) => {
    if (!myUid) return;
    await deleteDoc(doc(firestore, 'users', myUid, 'blocks', targetUid));
  };

  return { blockedUids, loading, blockUser, unblockUser };
}
