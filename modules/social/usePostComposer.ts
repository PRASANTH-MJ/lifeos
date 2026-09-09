import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState } from 'react';

import type { ShareCardData } from '@/components';
import { auth, firestore } from '@/firebase/config';

import { isPostRateLimited } from './rateLimit';
import type { PostType, WorkoutTemplatePayload } from './types';
import { uploadPostPhoto } from './uploadPostPhoto';

/** Creates a post directly (client write, not a callable) — unlike follow/unfollow, this doesn't
 * need to touch another user's document, so a plain Firestore write is enough (see
 * firestore.rules: create just checks authorUid == the caller, and likeCount/commentCount == 0).
 * The onPostCreated trigger (functions/index.js) handles fanning it out to followers' feeds
 * afterward.
 *
 * The post's doc id is reserved client-side (`doc(collection(...))`, no network round-trip)
 * BEFORE writing anything, so a photo can be uploaded to `posts/{uid}/{postId}.jpg` and its URL
 * included in the one-and-only write — posts are immutable once created (no update allowed), so
 * there's no "create then patch in the photo URL" step available.
 *
 * `authorUsernameLower`/`authorAvatarUrl` are a deliberate denormalization: without them, every
 * PostCard (in the feed, in a profile grid, in the Liked tab) would need its own separate
 * usePublicProfile(authorUid) listener just to know who to show as the author — which, on a
 * screen rendering many posts at once, means many independent listeners racing to resolve, each
 * popping the author's name in a beat after the post itself renders (a visible flicker). Copying
 * the author's identity onto the post once, at creation time, means every renderer of that post —
 * including onPostCreated's fan-out into followers' feeds below — already has it in the same read.
 *
 * `visibility` is always 'public' for v1 — there's no private-account enforcement yet (see
 * modules/social's plan notes), so every post is readable by any signed-in user regardless of the
 * author's isPrivate flag. */
export function usePostComposer() {
  const [posting, setPosting] = useState(false);

  const createPost = async (values: {
    type: PostType;
    card?: ShareCardData | null;
    caption?: string | null;
    localPhotoUri?: string | null;
    /** A multi-card carousel (route map, stats card, streak card, a user's own photo, etc — see
     * components/ActivityShareCarousel.tsx). When given (and non-empty) this wins over
     * `localPhotoUri` above entirely. Every page is uploaded, `photoUrls` gets the full list, and
     * `photoUrl` still gets the first entry so every existing single-photo reader keeps working
     * unchanged (see modules/social/types.ts's Post.photoUrls doc). */
    localPhotoUris?: string[] | null;
    workoutTemplate?: WorkoutTemplatePayload | null;
  }) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    // See rateLimit.ts — soft/advisory only, meant to catch an accidental burst, not a
    // determined bad actor.
    if (await isPostRateLimited(uid)) {
      throw new Error('RATE_LIMITED');
    }
    setPosting(true);
    try {
      const postRef = doc(collection(firestore, 'posts'));
      const localUris = values.localPhotoUris && values.localPhotoUris.length > 0 ? values.localPhotoUris : values.localPhotoUri ? [values.localPhotoUri] : [];
      // A lone photo keeps the original `{postId}.{ext}` naming (no `index` arg) — only a real
      // multi-page carousel needs distinct per-page object paths.
      const [uploadedUrls, myProfileSnap] = await Promise.all([
        Promise.all(localUris.map((uri, i) => uploadPostPhoto(uid, postRef.id, uri, localUris.length > 1 ? i : undefined))),
        getDoc(doc(firestore, 'userPublicProfiles', uid)),
      ]);
      const myProfile = myProfileSnap.data();

      await setDoc(postRef, {
        authorUid: uid,
        authorUsernameLower: myProfile?.usernameLower ?? '',
        authorAvatarUrl: myProfile?.avatarUrl ?? null,
        type: values.type,
        card: values.card ?? null,
        photoUrl: uploadedUrls[0] ?? null,
        photoUrls: uploadedUrls.length > 1 ? uploadedUrls : null,
        caption: values.caption?.trim() || null,
        workoutTemplate: values.workoutTemplate ?? null,
        visibility: 'public',
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      return postRef.id;
    } finally {
      setPosting(false);
    }
  };

  return { createPost, posting };
}
