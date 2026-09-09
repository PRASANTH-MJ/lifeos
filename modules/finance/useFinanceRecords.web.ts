import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

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

type AccountRow = {
  id: number;
  current_balance: number;
  is_archived: number;
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

/** Web build of useFinanceRecords.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write to finance_transactions or finance_accounts
 * from any tab (or the sync engine) re-runs this query automatically. The SQL
 * `WHERE date >= ? AND date <= ? ORDER BY date ASC, created_at ASC` becomes a JS filter/sort
 * over the full table (small personal-finance datasets), and the `SUM(current_balance) WHERE
 * is_archived = 0` aggregate becomes a JS reduce. */
export function useFinanceRecords(days: number) {
  const result = useLiveQuery(async () => {
    const today = todayKey();
    const start = addDays(today, -(days - 1));

    const [accountRows, txRows] = await Promise.all([
      webDb.finance_accounts.toArray() as unknown as Promise<AccountRow[]>,
      webDb.finance_transactions.toArray() as unknown as Promise<TransactionRow[]>,
    ]);

    const netWorthToday = accountRows
      .filter((a) => !a.is_archived)
      .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

    const ascending = txRows
      .filter((row) => row.date >= start && row.date <= today)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .map(toTransaction);

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

    return nextGroups;
  }, [days]);

  const loading = result === undefined;

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { groups: result ?? [], loading, refresh };
}
