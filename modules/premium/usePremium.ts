import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';

import { firestore, functions } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { useProfile } from '@/modules/profile';
import type { PlanKey } from './purchase';

/** Keeps the local premium cache (user_profile.premium, read everywhere else via useProfile())
 * in sync with Firestore — mount this once near the root (see app/_layout.tsx) so the listener
 * stays alive for as long as the app is open. Screens that need to know premium status just read
 * `useProfile().profile?.premium` directly; they don't need this hook themselves.
 *
 * That cached boolean is "effectively premium" — a real subscription OR an active trial — not
 * just the raw Firestore `premium` field, so every existing gate across the app (habits, tasks,
 * finance, useFreeTierGate, settings' feature gates, etc.) honors the trial automatically with no
 * changes needed at any of those call sites.
 *
 * `plan`/`subscriptionStatus`/`trialEndsAt`/`trialActive`/`trialDaysLeft` are display-only —
 * unlike the boolean, they're not cached to SQLite, since gating logic only ever needs the
 * boolean and doesn't need to work offline for a "which plan"/"days left" label. */
export function usePremium() {
  const { user } = useAuth();
  const { profile, syncAccount } = useProfile();
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<number | null>(null);
  const [rawPremium, setRawPremium] = useState(false);
  const requestedTrialFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      syncAccount(null, false);
      setPlan(null);
      setSubscriptionStatus(null);
      setTrialEndsAt(null);
      setRawPremium(false);
      requestedTrialFor.current = null;
      return;
    }

    return onSnapshot(
      doc(firestore, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        const premium = Boolean(data?.premium);
        const endsAt = (data?.trialEndsAt as number | undefined) ?? null;
        const trialActive = !premium && endsAt != null && Date.now() < endsAt;

        syncAccount(user.uid, premium || trialActive);
        setPlan((data?.plan as PlanKey | undefined) ?? null);
        setSubscriptionStatus((data?.subscriptionStatus as string | undefined) ?? null);
        setTrialEndsAt(endsAt);
        setRawPremium(premium);

        // A free account with no trial on record yet (brand-new signup, or an existing free user
        // who predates this feature) gets one started — startTrialIfEligible is idempotent
        // server-side, so this is safe to fire more than once; the ref just avoids spamming the
        // callable on every snapshot within a single session.
        if (!premium && endsAt == null && requestedTrialFor.current !== user.uid) {
          requestedTrialFor.current = user.uid;
          httpsCallable<Record<string, never>, { trialEndsAt: number | null }>(functions, 'startTrialIfEligible')({}).catch(() => {
            requestedTrialFor.current = null; // let a later snapshot/session retry
          });
        }
      },
      () => {
        // Offline or a transient Firestore error — keep whatever premium status is already
        // cached locally rather than treating a network hiccup as a downgrade to free.
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const trialActive = !rawPremium && trialEndsAt != null && Date.now() < trialEndsAt;
  const trialDaysLeft = trialActive ? Math.max(0, Math.ceil((trialEndsAt! - Date.now()) / (24 * 60 * 60 * 1000))) : 0;

  return {
    premium: profile?.premium ?? false,
    plan,
    subscriptionStatus,
    trialEndsAt,
    trialActive,
    trialDaysLeft,
  };
}
