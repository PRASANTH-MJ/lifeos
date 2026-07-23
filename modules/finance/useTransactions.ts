import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { createTransaction, deleteTransaction, fetchTransactions, updateTransaction } from './api';
import type { Transaction, TransactionType } from './types';

export function useTransactions(start?: string, end?: string, accountId?: string) {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { transactions: rows } = await fetchTransactions(token, { start, end, accountId });
      setTransactions(rows);
    } finally {
      setLoading(false);
    }
  }, [token, start, end, accountId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addTransaction = useCallback(
    async (values: {
      accountId: string;
      toAccountId?: string | null;
      categoryId?: string | null;
      type: TransactionType;
      amount: number;
      date: string;
      note?: string | null;
    }) => {
      if (!token) return;
      await createTransaction(token, values);
      await refresh();
    },
    [token, refresh]
  );

  const editTransaction = useCallback(
    async (id: string, values: Partial<{ categoryId: string | null; amount: number; date: string; note: string | null }>) => {
      if (!token) return;
      await updateTransaction(token, id, values);
      await refresh();
    },
    [token, refresh]
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      if (!token) return;
      await deleteTransaction(token, id);
      await refresh();
    },
    [token, refresh]
  );

  return { transactions, loading, refresh, addTransaction, editTransaction, removeTransaction };
}
