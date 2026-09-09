import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

/** Wraps functions/index.js's 4 Family plan callables — each pairs a families/{ownerUid} doc
 * change with a member's users/{uid}.premium grant/revoke, which is why these can't be plain
 * client Firestore writes (see firestore.rules' families/familyInvites: allow write: if false). */
export function useFamilyActions() {
  const [submitting, setSubmitting] = useState(false);

  const inviteMember = async (username: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    setSubmitting(true);
    try {
      const invite = httpsCallable<{ username: string }, { invited: boolean }>(functions, 'inviteFamilyMember');
      await invite({ username });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error)?.message || 'Could not send that invite. Try again.' };
    } finally {
      setSubmitting(false);
    }
  };

  const respondToInvite = async (inviteId: string, accept: boolean): Promise<{ ok: true } | { ok: false; message: string }> => {
    setSubmitting(true);
    try {
      const respond = httpsCallable<{ inviteId: string; accept: boolean }, { accepted: boolean }>(functions, 'respondToFamilyInvite');
      await respond({ inviteId, accept });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error)?.message || 'Could not respond to that invite. Try again.' };
    } finally {
      setSubmitting(false);
    }
  };

  const removeMember = async (memberUid: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    setSubmitting(true);
    try {
      const remove = httpsCallable<{ memberUid: string }, { removed: boolean }>(functions, 'removeFamilyMember');
      await remove({ memberUid });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error)?.message || 'Could not remove that member. Try again.' };
    } finally {
      setSubmitting(false);
    }
  };

  const leaveFamily = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    setSubmitting(true);
    try {
      const leave = httpsCallable<void, { left: boolean }>(functions, 'leaveFamilyPlan');
      await leave();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: (error as Error)?.message || 'Could not leave the Family plan. Try again.' };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, inviteMember, respondToInvite, removeMember, leaveFamily };
}
