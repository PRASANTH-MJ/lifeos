import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { firestore, storage } from '@/firebase/config';

function avatarDoc(uid: string) {
  return doc(firestore, 'users', uid, 'profile', 'avatar');
}

/** Uploads a locally-picked image to Firebase Storage and records its URL in a small Firestore
 * doc (separate from the tightly-locked `users/{uid}` premium doc, and from the generic
 * modules/sync/ engine — this is the one field of user_profile that's worth following the
 * account across devices, without pulling the device-specific PIN/premium cache into that). */
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `avatars/${uid}/avatar.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  await setDoc(avatarDoc(uid), { avatarUrl: url, updatedAt: new Date().toISOString() }, { merge: true });
  return url;
}

export function subscribeAvatarUrl(uid: string, onChange: (url: string | null) => void): () => void {
  return onSnapshot(
    avatarDoc(uid),
    (snapshot) => onChange((snapshot.data()?.avatarUrl as string | undefined) ?? null),
    () => {
      // Offline or a transient error — keep whatever's already cached locally.
    }
  );
}
