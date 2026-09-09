import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

/** Live like/comment counts for a post — read from the `posts/{postId}` doc itself (not from a
 * feed-copy field), since those counts change after the one-time fan-out copy was written and
 * only the source doc is ever kept current (see onLikeCreated/onCommentCreated in
 * functions/index.js). Used by any screen showing a post — feed, profile, wherever. */
export function usePostEngagement(postId: string) {
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firestore, 'posts', postId),
      (snap) => {
        const data = snap.data();
        setLikeCount(data?.likeCount ?? 0);
        setCommentCount(data?.commentCount ?? 0);
      },
      () => {}
    );
    return unsubscribe;
  }, [postId]);

  return { likeCount, commentCount };
}
