import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

import { isCommentRateLimited } from './rateLimit';
import type { Comment } from './types';

const MAX_COMMENT_LENGTH = 500;

/** Comments on a post, oldest first — direct client reads/writes (not callables). commentCount
 * shown elsewhere is maintained separately by onCommentCreated/onCommentDeleted
 * (functions/index.js), not derived from this list's length, so it stays correct without needing
 * every viewer to load every comment.
 *
 * `enabled` (default true) gates the live listener itself — PostCard passes `commentsVisible` here
 * so a post's full comment thread is only ever fetched/subscribed once its comments modal is
 * actually opened, not for every rendered card. Before this, every visible PostCard in a feed
 * opened its own permanent comments-subcollection listener regardless of whether anyone ever
 * looked at the comments — for a 20-post feed that's 20 live subcollection listeners running at
 * all times just so the (usually unopened) comments modal would already have data if opened. The
 * comment *count* badge doesn't need this at all — it reads the denormalized count off the post
 * doc via usePostEngagement, independent of this hook. */
export function useComments(postId: string, enabled: boolean = true) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const q = query(collection(firestore, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setComments(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              authorUid: data.authorUid,
              text: data.text,
              createdAt: data.createdAt?.toMillis?.() ?? null,
              replyToCommentId: data.replyToCommentId ?? null,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [postId, enabled]);

  const addComment = async (text: string, replyToCommentId: string | null = null) => {
    const uid = auth.currentUser?.uid;
    const trimmed = text.trim().slice(0, MAX_COMMENT_LENGTH);
    if (!uid || !trimmed) return;
    // See rateLimit.ts — soft/advisory only, meant to catch an accidental burst, not a
    // determined bad actor.
    if (await isCommentRateLimited(uid)) {
      throw new Error('RATE_LIMITED');
    }
    await addDoc(collection(firestore, 'posts', postId, 'comments'), {
      authorUid: uid,
      text: trimmed,
      createdAt: serverTimestamp(),
      replyToCommentId,
    });
  };

  const removeComment = async (commentId: string) => {
    await deleteDoc(doc(firestore, 'posts', postId, 'comments', commentId));
  };

  return { comments, loading, addComment, removeComment };
}
