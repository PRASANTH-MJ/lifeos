import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Lets an admin or sub-admin remove another member from the club — see functions/index.js's
 * removeClubMember for the server-side role checks (a sub-admin can't remove another sub-admin or
 * an admin, and no one can remove a full admin this way). Same transactional memberCount shape as
 * leaveClub, just triggered by someone else. */
export function useRemoveClubMember() {
  const [submitting, setSubmitting] = useState(false);

  const removeMember = async (clubId: string, targetUid: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; targetUid: string }, { removed: boolean }>(functions, 'removeClubMember');
      await fn({ clubId, targetUid });
    } finally {
      setSubmitting(false);
    }
  };

  return { removeMember, submitting };
}
