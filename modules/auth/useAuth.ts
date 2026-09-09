import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/firebase/config';

/** Firebase's own error codes (e.g. 'auth/wrong-password') are accurate but not
 * something to show a non-technical user verbatim — map the common ones to plain text. */
function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email — try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        setUser(nextUser);
        setLoading(false);
        return;
      }
      // A restored session's ID token isn't guaranteed to be attached yet the instant this
      // fires — forcing it here, before the authenticated app (and its first httpsCallable
      // button) ever renders, means callables never race an in-flight token fetch on the
      // very first interaction after a fresh load.
      nextUser
        .getIdToken()
        .catch(() => {})
        .finally(() => {
          setUser(nextUser);
          setLoading(false);
        });
    });
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true } as const;
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) } as const;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { ok: true } as const;
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) } as const;
    }
  };

  const signOut = () => firebaseSignOut(auth);

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true } as const;
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) } as const;
    }
  };

  return { user, loading, signUp, signIn, signOut, resetPassword };
}
