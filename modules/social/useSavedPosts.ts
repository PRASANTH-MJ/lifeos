import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { Post } from './types';

/** Every post the signed-in user has saved/bookmarked, newest-saved-first — reads
 * `users/{uid}/savedPosts` (postId -> createdAt) and resolves each id against the live post doc,
 * same "reverse-index owner-scoped subcollection, not a collectionGroup query" shape as
 * useLikedPosts.ts, for the same Firestore list-query-rule reason. A saved post that's since been
 * deleted is simply filtered out (its own createdAt from savedPosts is left in place — see
 * useSavePost.ts, there's no cleanup fan-out for a deleted post's saves, same as likedPosts). */
export function useSavedPosts(uid: string | null | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'users', uid, 'savedPosts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const postIds = snapshot.docs.map((d) => d.id);
        const postDocs = await Promise.all(postIds.map((id) => getDoc(doc(firestore, 'posts', id))));
        setPosts(
          postDocs
            .filter((d) => d.exists())
            .map((d) => {
              const data = d.data()!;
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

  return { posts, loading };
}
