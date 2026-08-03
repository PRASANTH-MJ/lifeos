import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';

import { firestore } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { useProfile } from '@/modules/profile';

/** Keeps the local premium cache (user_profile.premium, read everywhere else via useProfile())
 * in sync with Firestore — mount this once near the root (see app/_layout.tsx) so the listener
 * stays alive for as long as the app is open. Screens that need to know premium status just read
 * `useProfile().profile?.premium` directly; they don't need this hook themselves. */
export function usePremium() {
  const { user } = useAuth();
  const { profile, syncAccount } = useProfile();

  useEffect(() => {
    if (!user) {
      syncAccount(null, false);
      return;
    }

    return onSnapshot(
      doc(firestore, 'users', user.uid),
      (snapshot) => syncAccount(user.uid, Boolean(snapshot.data()?.premium)),
      () => {
        // Offline or a transient Firestore error — keep whatever premium status is already
        // cached locally rather than treating a network hiccup as a downgrade to free.
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return { premium: profile?.premium ?? false };
}
