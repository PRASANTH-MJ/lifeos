import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

export type FollowDirection = 'followers' | 'following';

/** The list of uids following (or followed by) a given uid — read directly off the `follows`
 * collection (see firestore.rules: readable by either side of the edge), not a denormalized
 * list. Each screen using this pairs it with usePublicProfile per row to render name/username. */
export function useFollowList(uid: string | null | undefined, direction: FollowDirection) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const field = direction === 'followers' ? 'followedUid' : 'followerUid';
    const otherField = direction === 'followers' ? 'followerUid' : 'followedUid';
    const q = query(collection(firestore, 'follows'), where(field, '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUids(snapshot.docs.map((d) => d.data()[otherField] as string));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid, direction]);

  return { uids, loading };
}
