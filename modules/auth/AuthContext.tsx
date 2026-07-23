import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchMe, login as apiLogin, signup as apiSignup, type AuthUser } from './api';
import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

const TOKEN_KEY = 'lifeos_auth_token';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getSecureItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: restoredUser } = await fetchMe(token);
        setUser(restoredUser);
      } catch {
        await deleteSecureItem(TOKEN_KEY);
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (identifier: string, password: string) => {
    setError(null);
    try {
      const { token, user: signedInUser } = await apiLogin(identifier, password);
      await setSecureItem(TOKEN_KEY, token);
      setUser(signedInUser);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to sign in.';
      setError(message);
      throw e;
    }
  };

  const signUp = async (email: string, username: string, password: string) => {
    setError(null);
    try {
      const { token, user: newUser } = await apiSignup(email, username, password);
      await setSecureItem(TOKEN_KEY, token);
      setUser(newUser);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to sign up.';
      setError(message);
      throw e;
    }
  };

  const signOut = async () => {
    await deleteSecureItem(TOKEN_KEY);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, error, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
