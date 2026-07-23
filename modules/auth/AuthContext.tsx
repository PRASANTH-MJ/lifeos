import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchMe, login as apiLogin, signup as apiSignup, type AuthUser } from './api';
import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

const ACCOUNTS_KEY = 'lifeos_auth_accounts';
const ACTIVE_ID_KEY = 'lifeos_active_user_id';

type SavedAccount = { token: string; user: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  accounts: AuthUser[];
  loading: boolean;
  error: string | null;
  addingAccount: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  switchAccount: (userId: number) => Promise<void>;
  removeAccount: (userId: number) => Promise<void>;
  beginAddAccount: () => void;
  cancelAddAccount: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAccounts(): Promise<SavedAccount[]> {
  const raw = await getSecureItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: SavedAccount[]): Promise<void> {
  if (accounts.length === 0) {
    await deleteSecureItem(ACCOUNTS_KEY);
    return;
  }
  await setSecureItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadAccounts();
      const storedActiveId = await getSecureItem(ACTIVE_ID_KEY);
      const preferredId = storedActiveId ? Number(storedActiveId) : stored[0]?.user.id ?? null;
      const preferred = stored.find((a) => a.user.id === preferredId) ?? stored[0];

      if (!preferred) {
        setLoading(false);
        return;
      }

      try {
        const { user: refreshed } = await fetchMe(preferred.token);
        const refreshedAccounts = stored.map((a) => (a.user.id === refreshed.id ? { ...a, user: refreshed } : a));
        setSavedAccounts(refreshedAccounts);
        setActiveId(refreshed.id);
        await saveAccounts(refreshedAccounts);
        await setSecureItem(ACTIVE_ID_KEY, String(refreshed.id));
      } catch {
        // That account's token is dead — drop it and fall back to another saved one, if any.
        const remaining = stored.filter((a) => a.user.id !== preferred.user.id);
        setSavedAccounts(remaining);
        await saveAccounts(remaining);
        if (remaining[0]) {
          setActiveId(remaining[0].user.id);
          await setSecureItem(ACTIVE_ID_KEY, String(remaining[0].user.id));
        } else {
          setActiveId(null);
          await deleteSecureItem(ACTIVE_ID_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const upsertAndActivate = async (token: string, user: AuthUser) => {
    setSavedAccounts((prev) => {
      const next = [...prev.filter((a) => a.user.id !== user.id), { token, user }];
      saveAccounts(next);
      return next;
    });
    setActiveId(user.id);
    await setSecureItem(ACTIVE_ID_KEY, String(user.id));
    setAddingAccount(false);
  };

  const signIn = async (identifier: string, password: string) => {
    setError(null);
    try {
      const { token, user: signedInUser } = await apiLogin(identifier, password);
      await upsertAndActivate(token, signedInUser);
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
      await upsertAndActivate(token, newUser);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to sign up.';
      setError(message);
      throw e;
    }
  };

  const switchAccount = async (userId: number) => {
    const account = savedAccounts.find((a) => a.user.id === userId);
    if (!account) return;
    setActiveId(userId);
    await setSecureItem(ACTIVE_ID_KEY, String(userId));
    // Best-effort refresh in the background — don't block the switch on it.
    fetchMe(account.token)
      .then(({ user: refreshed }) => {
        setSavedAccounts((prev) => {
          const next = prev.map((a) => (a.user.id === refreshed.id ? { ...a, user: refreshed } : a));
          saveAccounts(next);
          return next;
        });
      })
      .catch(() => {});
  };

  const removeAccount = async (userId: number) => {
    const next = savedAccounts.filter((a) => a.user.id !== userId);
    setSavedAccounts(next);
    await saveAccounts(next);
    if (activeId === userId) {
      const fallback = next[0] ?? null;
      setActiveId(fallback?.user.id ?? null);
      if (fallback) {
        await setSecureItem(ACTIVE_ID_KEY, String(fallback.user.id));
      } else {
        await deleteSecureItem(ACTIVE_ID_KEY);
      }
    }
  };

  const beginAddAccount = () => setAddingAccount(true);
  const cancelAddAccount = () => setAddingAccount(false);

  const user = savedAccounts.find((a) => a.user.id === activeId)?.user ?? null;
  const accounts = savedAccounts.map((a) => a.user);

  return (
    <AuthContext.Provider
      value={{ user, accounts, loading, error, addingAccount, signIn, signUp, switchAccount, removeAccount, beginAddAccount, cancelAddAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
