import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { useProfile } from '@/modules/profile';
import type { PlanKey } from './purchase';

/** Keeps the local premium cache (user_profile.premium, read everywhere else via useProfile())
 * in sync with Firestore — mount this once near the root (see app/_layout.tsx) so the listener
 * stays alive for as long as the app is open. Screens that need to know premium status just read
 * `useProfile().profile?.premium` directly; they don't need this hook themselves.
 *
 * `plan`/`subscriptionStatus` are display-only (which tier, whether a subscription is active) —
 * unlike the boolean, they're not cached to SQLite, since gating logic only ever needs the
 * boolean and doesn't need to work offline for a "which plan" label. */
export function usePremium() {
  const { user } = useAuth();
  const { profile, syncAccount } = useProfile();
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      syncAccount(null, false);
      setPlan(null);
      setSubscriptionStatus(null);
      return;
    }

    return onSnapshot(
      doc(firestore, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        syncAccount(user.uid, Boolean(data?.premium));
        setPlan((data?.plan as PlanKey | undefined) ?? null);
        setSubscriptionStatus((data?.subscriptionStatus as string | undefined) ?? null);
      },
      () => {
        // Offline or a transient Firestore error — keep whatever premium status is already
        // cached locally rather than treating a network hiccup as a downgrade to free.
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return { premium: profile?.premium ?? false, plan, subscriptionStatus };
}
