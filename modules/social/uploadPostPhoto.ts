import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/firebase/config';

/** Same fetch→blob→uploadBytes shape as modules/profile/avatarSync.ts's uploadAvatar — the
 * established pattern in this codebase for turning a locally-picked image into a Storage URL.
 * Takes the post's id (reserved client-side before the post doc is written — see
 * usePostComposer.ts) so the photo can be uploaded and its URL known BEFORE the post doc is
 * created, since posts are immutable once created (no update allowed).
 *
 * Almost every caller hands this a `.jpg` from ImagePicker/captureRef, but the animated-GIF
 * share option (see PostToFeedPrompt.tsx / modules/social/gifExport.ts) hands it a `.gif`
 * instead — the storage extension (and the blob's own `type`, which `uploadBytes` uses as the
 * object's contentType metadata when set) follows whatever `localUri` actually is, rather than
 * being hardcoded, so a GIF isn't silently stored mislabeled as a jpeg.
 *
 * `index` is only passed for a multi-photo carousel post (see ActivityShareCarousel.tsx /
 * usePostComposer.ts's `localPhotoUris`) — each page needs its own distinct object path under the
 * same `posts/{uid}/{postId}...` prefix firestore.rules validates against, so a second upload
 * doesn't just overwrite the first at the exact same `{postId}.{ext}` key. Omitted (the single-
 * photo path, unchanged from before) keeps the original `{postId}.{ext}` naming exactly as-is. */
export async function uploadPostPhoto(uid: string, postId: string, localUri: string, index?: number): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const extension = localUri.toLowerCase().endsWith('.gif') ? 'gif' : 'jpg';
  const fileName = index == null ? `${postId}.${extension}` : `${postId}_${index}.${extension}`;
  const storageRef = ref(storage, `posts/${uid}/${fileName}`);
  await uploadBytes(storageRef, blob, extension === 'gif' ? { contentType: 'image/gif' } : undefined);
  return getDownloadURL(storageRef);
}
