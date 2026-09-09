import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

/** Strava-kudos-style reaction set — a fixed 4, matching the icon-driven (not emoji) visual
 * language used elsewhere in the app (see IconBadge/Ionicons usage throughout). 'like' is the
 * default/fastest reaction (a single tap), the other three are secondary and only reachable via
 * long-press. */
export type ReactionType = 'like' | 'fire' | 'flex' | 'clap';

/** The signed-in user's reaction to `postId` (or null if none), plus react()/removeReaction().
 * The reaction doc's id is the reactor's own uid (`posts/{postId}/likes/{me}`) — unchanged from
 * the original boolean-like shape, just with a `type` field added — so this stays a direct doc
 * listener (not a query) and a client can only ever create/update/delete its OWN reaction, never
 * someone else's — see firestore.rules. The denormalized likeCount shown elsewhere still lives on
 * the post doc, maintained only by onLikeCreated/onLikeDeleted (functions/index.js), which count
 * doc existence regardless of `type`, so it stays a plain "total reactions" count, not broken out
 * per reaction type. */
export function useLike(postId: string) {
  const [reaction, setReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) {
      setReaction(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'posts', postId, 'likes', myUid),
      (snap) => {
        const data = snap.data();
        setReaction(snap.exists() ? ((data?.type as ReactionType) ?? 'like') : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [postId, myUid]);

  /** Tapping the same reaction again removes it (toggle-off); tapping a different one while one
   * is already set swaps the type in place (an update, not delete+create) so a mind-changed
   * reaction doesn't fire a spurious extra like/unlike notification pair. */
  const react = async (type: ReactionType) => {
    if (!myUid) return;
    setSubmitting(true);
    try {
      const likeRef = doc(firestore, 'posts', postId, 'likes', myUid);
      if (reaction === type) {
        await deleteDoc(likeRef);
      } else if (reaction) {
        await updateDoc(likeRef, { type });
      } else {
        await setDoc(likeRef, { likerUid: myUid, type, createdAt: serverTimestamp() });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = () => react('like');

  return { reaction, isLiked: reaction !== null, loading, submitting, react, toggleLike };
}
