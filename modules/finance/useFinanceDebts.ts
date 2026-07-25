import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Debt, DebtDirection, DebtPayment } from './types';

type DebtRow = {
  id: number;
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note: string | null;
  is_closed: number;
  created_at: string;
  closed_at: string | null;
};

function toDebt(row: DebtRow): Debt {
  return {
    id: String(row.id),
    person_name: row.person_name,
    direction: row.direction,
    amount: row.amount,
    note: row.note,
    is_closed: !!row.is_closed,
    created_at: row.created_at,
    closed_at: row.closed_at,
  };
}

/** Debts and their remaining balance (amount minus payments logged so far) — remaining is
 * computed at query time rather than a maintained column, since debts aren't a hot path. */
export function useFinanceDebts() {
  const db = useSQLiteContext();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [remainingById, setRemainingById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, paidRows] = await Promise.all([
        db.getAllAsync<DebtRow>('SELECT * FROM finance_debts ORDER BY is_closed ASC, created_at DESC'),
        db.getAllAsync<{ debt_id: number; total: number }>('SELECT debt_id, SUM(amount) as total FROM finance_debt_payments GROUP BY debt_id'),
      ]);
      const paidByDebt: Record<string, number> = {};
      for (const row of paidRows) paidByDebt[String(row.debt_id)] = row.total;

      const nextDebts = rows.map(toDebt);
      const nextRemaining: Record<string, number> = {};
      for (const debt of nextDebts) {
        nextRemaining[debt.id] = debt.amount - (paidByDebt[debt.id] ?? 0);
      }
      setDebts(nextDebts);
      setRemainingById(nextRemaining);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addDebt = useCallback(
    async (values: { personName: string; direction: DebtDirection; amount: number; note?: string | null }) => {
      await db.runAsync('INSERT INTO finance_debts (person_name, direction, amount, note, is_closed, created_at, closed_at) VALUES (?, ?, ?, ?, 0, ?, NULL)', [
        values.personName,
        values.direction,
        values.amount,
        values.note ?? null,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const setClosed = useCallback(
    async (id: string, isClosed: boolean) => {
      await db.runAsync('UPDATE finance_debts SET is_closed = ?, closed_at = ? WHERE id = ?', [
        isClosed ? 1 : 0,
        isClosed ? new Date().toISOString() : null,
        Number(id),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const removeDebt = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_debts WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { debts, remainingById, loading, refresh, addDebt, setClosed, removeDebt };
}

export function useDebtPayments(debtId: string) {
  const db = useSQLiteContext();
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ id: number; debt_id: number; amount: number; date: string; created_at: string }>(
        'SELECT * FROM finance_debt_payments WHERE debt_id = ? ORDER BY date DESC, created_at DESC',
        [Number(debtId)]
      );
      setPayments(rows.map((r) => ({ id: String(r.id), debt_id: String(r.debt_id), amount: r.amount, date: r.date, created_at: r.created_at })));
    } finally {
      setLoading(false);
    }
  }, [db, debtId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addPayment = useCallback(
    async (amount: number, date: string) => {
      await db.runAsync('INSERT INTO finance_debt_payments (debt_id, amount, date, created_at) VALUES (?, ?, ?, ?)', [
        Number(debtId),
        amount,
        date,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, debtId, refresh]
  );

  const removePayment = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_debt_payments WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { payments, loading, addPayment, removePayment };
}
