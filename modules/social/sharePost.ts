import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

/** "Share outside the app" for a photo/text post — opens the native share sheet (or falls back to
 * RN's own Share API for text-only), the same "let the OS handle it" approach as
 * ShareCardModal.tsx already uses for activity/streak cards (screenshot + expo-sharing). A post
 * photo lives at a remote Storage URL, and expo-sharing needs a local file, so it's downloaded to
 * cache first via File.downloadFileAsync — the same primitive File.downloadFileAsync already
 * exposes for this exact "remote URL → local file" step, no manual blob/base64 handling needed. */
export async function sharePost(post: { photoUrl: string | null; caption: string | null; shareUrl?: string | null }): Promise<void> {
  // expo-sharing's file share (below) has no text/url field to attach the public link to, so a
  // photo takes priority there same as before; the link only rides along on the plain-text
  // fallback. Good enough for now — see PostCard.tsx's onShare for why this isn't worth
  // reworking further.
  if (post.photoUrl) {
    const file = await File.downloadFileAsync(post.photoUrl, new Directory(Paths.cache));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg' });
      return;
    }
  }
  const message = [post.caption, post.shareUrl].filter(Boolean).join('\n\n');
  if (message) {
    await Share.share({ message });
  }
}
