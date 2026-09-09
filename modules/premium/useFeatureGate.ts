import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { auth, firestore } from '@/firebase/config';
import { useProfile } from '@/modules/profile';

/** Every screen/action gated behind Pro that isn't a plain count cap (see limits.ts's
 * FREE_LIMITS) — keep this list in sync with whatever `<PremiumGate feature="...">` or
 * `useFeatureGate(...)` calls actually exist, since it's also the source of truth a future audit
 * would check "does every advertised Pro feature actually have a runtime gate" against. */
export type PremiumFeature = 'workoutAnalytics' | 'foodAnalytics' | 'muscleRecovery' | 'exerciseLibraryBrowse';

/** Fire-and-forget: one write per paywall hit to `users/{uid}/paywallEvents` (see firestore.rules
 * — create-only, nothing reads this back client-side). This is the only place in the app that
 * records "someone hit a Pro wall" at all; without it there's no way to tell which gate is
 * actually driving upgrade intent vs. which one is just annoying people. */
function logPaywallHit(feature: PremiumFeature): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  addDoc(collection(firestore, 'users', uid, 'paywallEvents'), { feature, createdAt: serverTimestamp() }).catch(() => {});
}

/** Same "effectively premium" boolean useFreeTierGate already uses (profile.premium already folds
 * in an active free trial — see usePremium.ts's own doc comment) — every Pro gate in the app,
 * count-based or feature-based, reads from this one cached value so a mid-trial user never sees
 * inconsistent gating between screens. */
export function useFeatureGate(feature: PremiumFeature) {
  const { profile } = useProfile();
  const allowed = profile?.premium ?? false;

  /** Call when rendering a locked screen/section — logs the hit once the gate is actually shown,
   * not just on interaction (so a screen-level gate like PremiumGate gets counted too). */
  const logHit = () => logPaywallHit(feature);

  /** Call at the point of an action (e.g. tapping a tab) rather than on render — returns whether
   * the action may proceed, logging + leaving upsell UI to the caller when it can't. */
  const requestAccess = (): boolean => {
    if (allowed) return true;
    logPaywallHit(feature);
    return false;
  };

  return { allowed, logHit, requestAccess };
}
