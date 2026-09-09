import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

/** Whether the signed-in user has bookmarked `postId`, plus toggleSave() — `users/{me}/savedPosts/{postId}`
 * is a direct doc listener keyed by the post id (same shape as useLike.ts's `posts/{postId}/likes/{me}`,
 * just under the viewer's own uid instead), so a client can only ever save/unsave POSTS INTO THEIR
 * OWN LIST, never write into anyone else's — see firestore.rules. */
export function useSavePost(postId: string) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) {
      setSaved(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'users', myUid, 'savedPosts', postId),
      (snap) => {
        setSaved(snap.exists());
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [postId, myUid]);

  const toggleSave = async () => {
    if (!myUid) return;
    setSubmitting(true);
    try {
      const savedRef = doc(firestore, 'users', myUid, 'savedPosts', postId);
      if (saved) {
        await deleteDoc(savedRef);
      } else {
        await setDoc(savedRef, { postId, createdAt: serverTimestamp() });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { saved, loading, submitting, toggleSave };
}
