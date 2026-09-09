/** Native deep link straight to a club's detail screen — same `lifeos://` scheme as
 * modules/social's post share link, resolved by expo-router's file-based routing (no manual
 * Linking config needed, see app.json's "scheme"). Kept intentionally simple: unlike posts, clubs
 * have no public unauthenticated web preview — an inviteOnly/private club's read access is still
 * gated by firestore.rules, so this link only actually opens the club for someone who already has
 * an invite (or is already a member). */
export function buildClubDeepLink(clubId: string): string {
  return `lifeos://social/clubs/${clubId}`;
}
