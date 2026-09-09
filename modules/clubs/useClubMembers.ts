import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

/** The list of member uids for a club — same "return uids, let the screen pair each with
 * usePublicProfile" shape as modules/social/useFollowList.ts, so the roster row can show
 * name/avatar/cardioLogCount without this hook needing to know about profile shape at all. */
export function useClubMembers(clubId: string | null | undefined) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setUids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'clubs', clubId, 'members'),
      (snapshot) => {
        setUids(snapshot.docs.map((d) => d.id));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { uids, loading };
}
