import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { Post } from './types';

/** A single post by id, live — used by app/post/[postId].tsx (the signed-in in-app view) and by
 * PublicPostPreview (the signed-out web share-link landing page), which is exactly why this
 * doesn't check `auth.currentUser` itself: firestore.rules already decides who may read a given
 * post (anyone, if it's public; only its author otherwise), so this hook just surfaces whatever
 * that resolves to — `post: null` covers "doesn't exist", "was deleted", and "exists but this
 * viewer isn't allowed to read it" alike, since Firestore denies the whole snapshot rather than
 * returning a partial doc. */
export function usePost(postId: string | undefined) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'posts', postId),
      (snap) => {
        if (!snap.exists()) {
          setPost(null);
        } else {
          const data = snap.data();
          setPost({
            id: snap.id,
            authorUid: data.authorUid,
            authorUsernameLower: data.authorUsernameLower ?? '',
            authorAvatarUrl: data.authorAvatarUrl ?? null,
            type: data.type,
            card: data.card ?? null,
            photoUrl: data.photoUrl ?? null,
            photoUrls: data.photoUrls ?? null,
            caption: data.caption ?? null,
            workoutTemplate: data.workoutTemplate ?? null,
            createdAt: data.createdAt?.toMillis?.() ?? null,
          });
        }
        setLoading(false);
      },
      () => {
        setPost(null);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [postId]);

  return { post, loading };
}
