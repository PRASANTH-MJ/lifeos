import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey } from '@/lib/date';

import type { Transaction, TransactionType } from './types';

export type RecordEntry = Transaction & { balanceAfter: number };
export type RecordGroup = { monthLabel: string; balance: number; sum: number; entries: RecordEntry[] };

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

function monthLabelOf(dateKey: string): string {
  const [year, month] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
}

/** Transactions for the trailing `days` window, each annotated with the running total net worth
 * right after it happened, grouped by month — the "Records" ledger view. Net worth is
 * reconstructed the same way the Balance Trend chart does (walk backward from today's known
 * total), since transfers between the user's own accounts never change that total. */
export function useFinanceRecords(days: number) {
  const db = useSQLiteContext();
  const [groups, setGroups] = useState<RecordGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const start = addDays(today, -(days - 1));

      const [netWorthRow, rows] = await Promise.all([
        db.getFirstAsync<{ total: number | null }>('SELECT SUM(current_balance) as total FROM finance_accounts WHERE is_archived = 0'),
        db.getAllAsync<TransactionRow>(
          'SELECT * FROM finance_transactions WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC',
          [start, today]
        ),
      ]);

      const netWorthToday = netWorthRow?.total ?? 0;
      const ascending = rows.map(toTransaction);

      const totalDelta = ascending.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
      let cumulative = netWorthToday - totalDelta;
      const withBalance: RecordEntry[] = ascending.map((t) => {
        cumulative += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0;
        return { ...t, balanceAfter: cumulative };
      });

      withBalance.reverse();

      const byMonth = new Map<string, RecordEntry[]>();
      for (const entry of withBalance) {
        const key = entry.date.slice(0, 7);
        const list = byMonth.get(key) ?? [];
        list.push(entry);
        byMonth.set(key, list);
      }

      const nextGroups: RecordGroup[] = Array.from(byMonth.entries()).map(([key, entries]) => ({
        monthLabel: monthLabelOf(`${key}-01`),
        balance: entries[0].balanceAfter,
        sum: entries.reduce((sum, e) => sum + (e.type === 'income' ? e.amount : e.type === 'expense' ? -e.amount : 0), 0),
        entries,
      }));

      setGroups(nextGroups);
    } finally {
      setLoading(false);
    }
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { groups, loading, refresh };
}
