import type { User } from 'firebase/auth';

/** The one and only app-wide "is this the developer" check — there's no admin/owner-uid concept
 * anywhere else in this codebase (club `admins` arrays are per-club membership, not this). An
 * email check rather than a uid one is deliberate: a uid would need to be looked up out-of-band
 * (Firebase console) and hardcoded, where the developer's own login email is already known.
 *
 * This is UX gating only (hides app/admin-analytics.tsx from everyone else) — MUST stay in sync
 * BY HAND with functions/index.js's ADMIN_EMAIL, which is the actual security boundary (a client
 * can't be trusted to police itself). The two can't share a constant: functions/ is a separate
 * deployable with no build step wiring it to this app's modules.
 */
export const ADMIN_EMAIL = 'prasanth.j@aica.cloud';

export function isAdminUser(user: User | null): boolean {
  return user?.email === ADMIN_EMAIL;
}
