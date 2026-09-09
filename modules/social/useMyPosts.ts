import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { Post } from './types';

/** A given user's own authored posts, newest first — used on their profile screen. Every post is
 * `visibility: 'public'` in v1 (see usePostComposer's doc comment), so this works the same
 * whether `uid` is the signed-in user or someone else's profile being viewed.
 *
 * The `visibility == 'public'` filter below is not just a convenience — Firestore evaluates a
 * query's security rule against every document the query *could* match, not just the ones it
 * actually returns. The posts rule is `visibility == 'public' || authorUid == request.auth.uid`;
 * without an equality filter on `visibility` in the query itself, Firestore can't statically
 * prove that clause holds for the whole potential result set when the viewer isn't the author
 * (a query with only `where('authorUid','==',uid)` could theoretically match a private post), so
 * it denies the entire query with permission-denied — even though the one document that exists
 * is actually public. Filtering on `visibility` here is what makes the rule provable. */
export function useUserPosts(uid: string | null | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(firestore, 'posts'),
      where('authorUid', '==', uid),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPosts(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
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
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  const removePost = async (postId: string) => {
    await deleteDoc(doc(firestore, 'posts', postId));
  };

  return { posts, loading, removePost };
}
