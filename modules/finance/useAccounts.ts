import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { createAccount, deleteAccount, fetchAccounts, updateAccount } from './api';
import type { Account, AccountType } from './types';

export function useAccounts() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { accounts: rows } = await fetchAccounts(token);
      setAccounts(rows);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Refetch every time this screen regains focus — e.g. after logging a
  // transaction on another screen, which changes balances via a DB trigger
  // this hook has no other way of knowing about.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addAccount = useCallback(
    async (values: { name: string; type: AccountType; currency?: string; currentBalance?: number }) => {
      if (!token) return;
      await createAccount(token, values);
      await refresh();
    },
    [token, refresh]
  );

  const editAccount = useCallback(
    async (id: string, values: Partial<{ name: string; type: AccountType; currency: string; isArchived: boolean }>) => {
      if (!token) return;
      await updateAccount(token, id, values);
      await refresh();
    },
    [token, refresh]
  );

  const archiveAccount = useCallback((id: string) => (token ? updateAccount(token, id, { isArchived: true }).then(() => refresh()) : Promise.resolve()), [token, refresh]);

  const removeAccount = useCallback(
    async (id: string) => {
      if (!token) return;
      await deleteAccount(token, id);
      await refresh();
    },
    [token, refresh]
  );

  const netWorth = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.current_balance), 0), [accounts]);
  const accountsByType = useMemo(() => {
    const groups = new Map<string, Account[]>();
    for (const account of accounts) {
      const list = groups.get(account.type) ?? [];
      list.push(account);
      groups.set(account.type, list);
    }
    return groups;
  }, [accounts]);

  return { accounts, accountsByType, netWorth, loading, refresh, addAccount, editAccount, archiveAccount, removeAccount };
}
