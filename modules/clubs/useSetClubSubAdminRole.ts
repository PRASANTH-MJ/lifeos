import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Promotes/demotes a member to/from the club's `subAdmins` roster — see functions/index.js's
 * setClubSubAdminRole, which re-checks server-side that the caller is a FULL admin (not just a
 * sub-admin themselves) and that the target isn't already a full admin. */
export function useSetClubSubAdminRole() {
  const [submitting, setSubmitting] = useState(false);

  const setSubAdmin = async (clubId: string, targetUid: string, isSubAdmin: boolean): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; targetUid: string; isSubAdmin: boolean }, { isSubAdmin: boolean }>(
        functions,
        'setClubSubAdminRole'
      );
      await fn({ clubId, targetUid, isSubAdmin });
    } finally {
      setSubmitting(false);
    }
  };

  return { setSubAdmin, submitting };
}
