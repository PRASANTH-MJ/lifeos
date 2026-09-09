import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { auth, firestore, storage } from '@/firebase/config';

export type EventPhoto = {
  id: string;
  uploaderUid: string;
  photoUrl: string;
  createdAtMs: number;
};

/** Same fetch→blob→uploadBytes shape as modules/social/uploadPostPhoto.ts's uploadPostPhoto —
 * the established pattern for turning a locally-picked image into a Storage URL. Stored under the
 * event (not the uploader), since this is a shared album any attendee contributes to, not a
 * per-user photo. */
export async function uploadEventPhoto(clubId: string, eventId: string, photoId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `event-photos/${clubId}/${eventId}/${photoId}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/** A shared post-event photo album — every attendee can add to it (see firestore.rules: create
 * requires being the uploader AND an attendee of this event), same direct-client-write,
 * append-only shape as modules/clubs/useUpdates.ts's `updates` subcollection. */
export function useEventPhotos(clubId: string | null | undefined, eventId: string | null | undefined) {
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!clubId || !eventId) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'clubs', clubId, 'events', eventId, 'photos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPhotos(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              uploaderUid: (data.uploaderUid as string) ?? '',
              photoUrl: (data.photoUrl as string) ?? '',
              createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId, eventId]);

  const addPhoto = async (localUri: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !clubId || !eventId) return;
    setUploading(true);
    try {
      const photosRef = collection(firestore, 'clubs', clubId, 'events', eventId, 'photos');
      const draftRef = doc(photosRef);
      const photoUrl = await uploadEventPhoto(clubId, eventId, draftRef.id, localUri);
      await setDoc(draftRef, { uploaderUid: uid, photoUrl, createdAt: serverTimestamp() });
    } finally {
      setUploading(false);
    }
  };

  return { photos, loading, uploading, addPhoto };
}
