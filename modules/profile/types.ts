export type UserProfile = {
  name: string | null;
  avatarUri: string | null;
  pinEnabled: boolean;
  pinHash: string | null;
  firebaseUid: string | null;
  /** Cached from Firestore — see modules/premium/usePremium.ts for the source of truth. */
  premium: boolean;
};
