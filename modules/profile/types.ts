export type Gender = 'female' | 'male' | 'other';

export type UserProfile = {
  name: string | null;
  avatarUri: string | null;
  pinEnabled: boolean;
  pinHash: string | null;
  biometricEnabled: boolean;
  firebaseUid: string | null;
  /** Cached from Firestore — see modules/premium/usePremium.ts for the source of truth. */
  premium: boolean;
  /** Null until answered during onboarding — see modules/cycle's shouldShowCycleTracking for the
   * one place this currently affects anything. */
  gender: Gender | null;
};
