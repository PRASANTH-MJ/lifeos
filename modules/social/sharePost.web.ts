/** Web build of sharePost.ts — expo-file-system's File.downloadFileAsync + expo-sharing's native
 * share sheet don't apply on web, so this uses the browser's own Web Share API where available,
 * falling back to opening the photo in a new tab or copying the caption to the clipboard. */
export async function sharePost(post: { photoUrl: string | null; caption: string | null; shareUrl?: string | null }): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text: post.caption ?? undefined, url: post.shareUrl ?? post.photoUrl ?? undefined });
      return;
    } catch {
      // User cancelled, or the browser rejected the share — fall through to the manual paths below.
    }
  }

  if (post.shareUrl && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(post.shareUrl);
  } else if (post.photoUrl && typeof window !== 'undefined') {
    window.open(post.photoUrl, '_blank');
  } else if (post.caption && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(post.caption);
  }
}
