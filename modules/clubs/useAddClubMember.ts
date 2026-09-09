import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Adds someone (by uid) straight into a club — no invite/accept step, see functions/index.js's
 * addClubMember. Used by the "Add people" screen, which lets an existing member pick from who
 * they follow. */
export function useAddClubMember() {
  const [submitting, setSubmitting] = useState(false);

  const addMember = async (clubId: string, uid: string): Promise<void> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string; uid: string }, { added: boolean }>(functions, 'addClubMember');
      await fn({ clubId, uid });
    } finally {
      setSubmitting(false);
    }
  };

  return { addMember, submitting };
}
