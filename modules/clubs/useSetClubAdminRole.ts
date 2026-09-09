import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Promotes/demotes a member to/from the club's admin roster — see functions/index.js's
 * setClubAdminRole, which re-checks the caller is already an admin server-side. */
export function useSetClubAdminRole() {
  const [submitting, setSubmitting] = useState(false);

  const setAdmin = async (clubId: string, targetUid: string, isAdmin: boolean): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; targetUid: string; isAdmin: boolean }, { isAdmin: boolean }>(functions, 'setClubAdminRole');
      await fn({ clubId, targetUid, isAdmin });
    } finally {
      setSubmitting(false);
    }
  };

  return { setAdmin, submitting };
}
