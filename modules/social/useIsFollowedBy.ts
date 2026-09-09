import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

/** Whether `otherUid` follows the signed-in user — the reverse of useFollow's "do I follow them"
 * — used only to decide when a FollowButton should read "Follow Back" instead of plain "Follow",
 * Instagram-style. Same direct doc-id read as useFollow, just the other edge:
 * follows/{otherUid}_{me} instead of follows/{me}_{otherUid}. */
export function useIsFollowedBy(otherUid: string | null | undefined) {
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid || !otherUid || myUid === otherUid) {
      setTheyFollowMe(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(firestore, 'follows', `${otherUid}_${myUid}`),
      (snap) => setTheyFollowMe(snap.exists()),
      () => setTheyFollowMe(false)
    );
    return unsubscribe;
  }, [myUid, otherUid]);

  return theyFollowMe;
}
