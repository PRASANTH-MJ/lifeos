/** The static-export web build's own hosting origin (see firebase.json's `lifeos-8f0bf` site) —
 * a public post's shareable URL always points here, never at the native `lifeos://` scheme,
 * since it needs to work for a recipient who may not have the app installed (see
 * app/post/[postId].tsx and modules/social/PublicPostPreview.tsx, which is what actually renders
 * at this URL for a signed-out visitor). */
const PUBLIC_WEB_ORIGIN = 'https://lifeos-8f0bf.web.app';

export function buildPostShareUrl(postId: string): string {
  return `${PUBLIC_WEB_ORIGIN}/post/${postId}`;
}
