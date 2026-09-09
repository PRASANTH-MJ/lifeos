import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';

import { functions } from '@/firebase/config';

function friendlyUsernameError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('already-exists')) return 'That username is taken.';
  if (message.includes('invalid-argument')) return 'Usernames must be 3-20 characters: lowercase letters, numbers, underscores.';
  return 'Something went wrong. Please try again.';
}

/** Thin wrapper over the claimUsername Cloud Function (functions/index.js) — claiming/renaming a
 * handle needs a cross-user uniqueness check (the `usernames/{usernameLower}` reservation), which
 * a security rule alone can't safely arbitrate, so this is a callable rather than a direct
 * Firestore write. */
export function useUsernameSetup() {
  const [submitting, setSubmitting] = useState(false);

  const claimUsername = async (values: {
    username: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
  }): Promise<{ ok: true } | { ok: false; message: string }> => {
    setSubmitting(true);
    try {
      const fn = httpsCallable<typeof values, { usernameLower: string }>(functions, 'claimUsername');
      await fn(values);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: friendlyUsernameError(err) };
    } finally {
      setSubmitting(false);
    }
  };

  return { claimUsername, submitting };
}
