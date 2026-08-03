import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

import type { Account, AccountType } from './types';

type AccountRow = {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  current_balance: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

function toAccount(row: AccountRow): Account {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    currency: row.currency,
    current_balance: row.current_balance,
    is_archived: !!row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useAccounts() {
  const db = useSQLiteContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<AccountRow>('SELECT * FROM finance_accounts WHERE is_archived = 0 ORDER BY created_at ASC');
      setAccounts(rows.map(toAccount));
    } finally {
      setLoading(false);
    }
  }, [db]);

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
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO finance_accounts (name, type, currency, current_balance, is_archived, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
        [values.name, values.type, values.currency ?? 'USD', values.currentBalance ?? 0, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'finance_accounts', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const editAccount = useCallback(
    async (id: string, values: Partial<{ name: string; type: AccountType; currency: string; isArchived: boolean }>) => {
      const updates: string[] = [];
      const params: (string | number)[] = [];
      if (values.name !== undefined) {
        updates.push('name = ?');
        params.push(values.name);
      }
      if (values.type !== undefined) {
        updates.push('type = ?');
        params.push(values.type);
      }
      if (values.currency !== undefined) {
        updates.push('currency = ?');
        params.push(values.currency);
      }
      if (values.isArchived !== undefined) {
        updates.push('is_archived = ?');
        params.push(values.isArchived ? 1 : 0);
      }
      if (updates.length === 0) return;
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(Number(id));
      await db.runAsync(`UPDATE finance_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
      await pushLocalRow(db, 'finance_accounts', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const archiveAccount = useCallback((id: string) => editAccount(id, { isArchived: true }), [editAccount]);

  const removeAccount = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving(db, 'finance_accounts', Number(id));
      await db.runAsync('DELETE FROM finance_accounts WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
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
