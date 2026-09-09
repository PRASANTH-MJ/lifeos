import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';

import type { Post } from './types';

/** Every post a given uid has liked, newest-like-first — reads the uid's own
 * `users/{uid}/likedPosts` reverse-index (postId -> createdAt), fanned out by
 * onLikeCreated/onLikeDeleted whenever a like is created/removed (see functions/index.js), rather
 * than a collectionGroup('likes') scan across every post's likes subcollection. Firestore denies
 * a list/collection-group query outright unless it can prove the rule holds for every document
 * the query *could* match, not just the ones it returns — reading only the caller's own
 * owner-scoped subcollection here sidesteps that entirely, same as users/{uid}/feed. */
export function useLikedPosts(uid: string | null | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'users', uid, 'likedPosts'), orderBy('createdAt', 'desc'));
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
