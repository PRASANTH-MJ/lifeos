import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { firestore, storage } from '@/firebase/config';

/** Uploads a locally-picked image to Firebase Storage and records the URL on the club doc itself
 * — mirrors modules/profile/avatarSync.ts's uploadAvatar, just writing `photoUrl` on
 * clubs/{clubId} instead of a separate per-user doc, since firestore.rules already restricts that
 * field's update to the club's own admins. */
export async function uploadClubPhoto(clubId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `club-photos/${clubId}/photo.jpg`);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(firestore, 'clubs', clubId), { photoUrl: url });
  return url;
}
