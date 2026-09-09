import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';
import { uploadPostPhoto } from '@/modules/social/uploadPostPhoto';

export type ClubUpdate = {
  id: string;
  authorUid: string;
  text: string | null;
  photoUrl: string | null;
  createdAtMs: number;
};

/** Shared by challenge and event "post an update" feeds — a lightweight, append-only photo/text
 * post scoped to one challenge or event, direct client writes (see firestore.rules: owned by
 * its author, no shared counter to touch, so no callable needed — same shape as the top-level
 * `posts` collection). `parentPath` is `clubs/{clubId}/challenges/{challengeId}` or
 * `clubs/{clubId}/events/{eventId}`. */
export function useUpdates(parentPath: string | null) {
  const [updates, setUpdates] = useState<ClubUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!parentPath) {
      setUpdates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, `${parentPath}/updates`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUpdates(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              authorUid: data.authorUid ?? '',
              text: data.text ?? null,
              photoUrl: data.photoUrl ?? null,
              createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [parentPath]);

  const postUpdate = async (values: { text: string | null; localPhotoUri: string | null }) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !parentPath) return;
    setPosting(true);
    try {
      const updatesRef = collection(firestore, `${parentPath}/updates`);
      const draftRef = doc(updatesRef);
      const photoUrl = values.localPhotoUri ? await uploadPostPhoto(uid, `club-update-${draftRef.id}`, values.localPhotoUri) : null;
      await setDoc(draftRef, {
        authorUid: uid,
        text: values.text?.trim() || null,
        photoUrl,
        createdAt: serverTimestamp(),
      });
    } finally {
      setPosting(false);
    }
  };

  return { updates, loading, posting, postUpdate };
}
