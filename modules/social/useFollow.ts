import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';

/** Whether the signed-in user follows `targetUid`, plus follow()/unfollow() actions. The edge
 * lives at the deterministic id `follows/{me}_{target}` (see functions/index.js), so checking it
 * is a direct doc listener, not a query — and follow/unfollow go through callables rather than a
 * direct Firestore write because they also need to atomically update the OTHER user's
 * followerCount, which a client can't safely do to a document it doesn't own.
 *
 * `optimistic` flips the instant follow()/unfollow() is called, ahead of both the callable
 * resolving and the onSnapshot listener catching up — without it, the button's label briefly
 * reverts to its old state for a beat after the loading spinner clears (spinner → old label →
 * new label), reading as a flicker rather than a clean transition. It's cleared once the
 * listener's own value agrees, so a callable that actually fails still snaps back to the truth. */
export function useFollow(targetUid: string | null | undefined) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid || !targetUid || myUid === targetUid) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'follows', `${myUid}_${targetUid}`),
      (snap) => {
        const exists = snap.exists();
        setIsFollowing(exists);
        setOptimistic((current) => (current === exists ? null : current));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [myUid, targetUid]);

  const follow = async () => {
    if (!targetUid) return;
    setOptimistic(true);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ targetUid: string }, { following: boolean }>(functions, 'followUser');
      await fn({ targetUid });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const unfollow = async () => {
    if (!targetUid) return;
    setOptimistic(false);
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ targetUid: string }, { following: boolean }>(functions, 'unfollowUser');
      await fn({ targetUid });
    } catch (err) {
      setOptimistic(null);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { isFollowing: optimistic ?? isFollowing, loading, submitting, follow, unfollow };
}
