import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Transaction, TransactionType } from './types';

type TransactionRow = {
  id: number;
  account_id: number;
  category_id: number | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  to_account_id: number | null;
  created_at: string;
};

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    category_id: row.category_id != null ? String(row.category_id) : null,
    type: row.type,
    amount: row.amount,
    date: row.date,
    note: row.note,
    to_account_id: row.to_account_id != null ? String(row.to_account_id) : null,
    created_at: row.created_at,
  };
}

export function useTransactions(start?: string, end?: string, accountId?: string) {
  const db = useSQLiteContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (start) {
        clauses.push('date >= ?');
        params.push(start);
      }
      if (end) {
        clauses.push('date <= ?');
        params.push(end);
      }
      if (accountId) {
        clauses.push('(account_id = ? OR to_account_id = ?)');
        params.push(Number(accountId), Number(accountId));
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await db.getAllAsync<TransactionRow>(
        `SELECT * FROM finance_transactions ${where} ORDER BY date DESC, created_at DESC`,
        params
      );
      setTransactions(rows.map(toTransaction));
    } finally {
      setLoading(false);
    }
  }, [db, start, end, accountId]);

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
      await db.runAsync(
        `INSERT INTO finance_transactions (account_id, category_id, type, amount, date, note, to_account_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(values.accountId),
          values.type === 'transfer' ? null : values.categoryId ? Number(values.categoryId) : null,
          values.type,
          values.amount,
          values.date,
          values.note ?? null,
          values.type === 'transfer' && values.toAccountId ? Number(values.toAccountId) : null,
          new Date().toISOString(),
        ]
      );
      await refresh();
    },
    [db, refresh]
  );

  const editTransaction = useCallback(
    async (id: string, values: Partial<{ categoryId: string | null; amount: number; date: string; note: string | null }>) => {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      if (values.categoryId !== undefined) {
        updates.push('category_id = ?');
        params.push(values.categoryId ? Number(values.categoryId) : null);
      }
      if (values.amount !== undefined) {
        updates.push('amount = ?');
        params.push(values.amount);
      }
      if (values.date !== undefined) {
        updates.push('date = ?');
        params.push(values.date);
      }
      if (values.note !== undefined) {
        updates.push('note = ?');
        params.push(values.note);
      }
      if (updates.length === 0) return;
      params.push(Number(id));
      await db.runAsync(`UPDATE finance_transactions SET ${updates.join(', ')} WHERE id = ?`, params);
      await refresh();
    },
    [db, refresh]
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_transactions WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { transactions, loading, refresh, addTransaction, editTransaction, removeTransaction };
}
