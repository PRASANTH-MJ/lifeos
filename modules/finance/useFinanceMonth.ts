import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { FinanceTransaction, TransactionType } from './types';

export function useFinanceMonth(year: number, month: number) {
  const db = useSQLiteContext();
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<FinanceTransaction>(
      'SELECT * FROM finance_transactions WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC',
      [start, end]
    );
    setTransactions(rows);
    setLoading(false);
  }, [db, start, end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTransaction = useCallback(
    async (values: { type: TransactionType; amount: number; category: string; note?: string; date: string }) => {
      await db.runAsync(
        'INSERT INTO finance_transactions (type, amount, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [values.type, values.amount, values.category, values.note ?? null, values.date, new Date().toISOString()]
      );
      await refresh();
    },
    [db, refresh]
  );

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      totalsByCategory.set(transaction.category, (totalsByCategory.get(transaction.category) ?? 0) + transaction.amount);
    }
    return Array.from(totalsByCategory.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  return { transactions, loading, totals, categoryBreakdown, createTransaction, refresh };
}
