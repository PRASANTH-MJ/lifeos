import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { PlannedPayment, PlannedPaymentFrequency } from './types';

type PlannedPaymentRow = {
  id: number;
  account_id: number;
  category_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  payee: string;
  frequency: PlannedPaymentFrequency;
  next_date: string;
  notify: number;
  note: string | null;
  is_active: number;
  created_at: string;
};

function toPlannedPayment(row: PlannedPaymentRow): PlannedPayment {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    category_id: row.category_id != null ? String(row.category_id) : null,
    type: row.type,
    amount: row.amount,
    payee: row.payee,
    frequency: row.frequency,
    next_date: row.next_date,
    notify: !!row.notify,
    note: row.note,
    is_active: !!row.is_active,
    created_at: row.created_at,
  };
}

/** Advances a `YYYY-MM-DD` key by one occurrence of `frequency` — `null` for 'once', since a
 * one-time payment has no next occurrence once it's been marked paid. */
export function advanceByFrequency(dateKey: string, frequency: PlannedPaymentFrequency): string | null {
  if (frequency === 'once') return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (frequency === 'weekly') date.setDate(date.getDate() + 7);
  else if (frequency === 'monthly') date.setMonth(date.getMonth() + 1);
  else date.setFullYear(date.getFullYear() + 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useFinancePlannedPayments() {
  const db = useSQLiteContext();
  const [plannedPayments, setPlannedPayments] = useState<PlannedPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<PlannedPaymentRow>(
        'SELECT * FROM finance_planned_payments WHERE is_active = 1 ORDER BY next_date ASC'
      );
      setPlannedPayments(rows.map(toPlannedPayment));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addPlannedPayment = useCallback(
    async (values: {
      accountId: string;
      categoryId?: string | null;
      type: 'income' | 'expense';
      amount: number;
      payee: string;
      frequency: PlannedPaymentFrequency;
      nextDate: string;
      notify: boolean;
      note?: string | null;
    }) => {
      const result = await db.runAsync(
        `INSERT INTO finance_planned_payments (account_id, category_id, type, amount, payee, frequency, next_date, notify, note, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          Number(values.accountId),
          values.categoryId ? Number(values.categoryId) : null,
          values.type,
          values.amount,
          values.payee,
          values.frequency,
          values.nextDate,
          values.notify ? 1 : 0,
          values.note ?? null,
          new Date().toISOString(),
        ]
      );
      await refresh();
      return String(result.lastInsertRowId);
    },
    [db, refresh]
  );

  /** Records the actual transaction this planned payment represents, then either advances it to
   * its next occurrence (recurring) or deactivates it (one-time) — a manual action, since LifeOS
   * has no background scheduler to post transactions on its own. Returns the new next_date (for
   * the caller to reschedule its reminder) or null if the payment is now fully done. */
  const markPaid = useCallback(
    async (payment: PlannedPayment): Promise<string | null> => {
      await db.runAsync(
        `INSERT INTO finance_transactions (account_id, category_id, type, amount, date, note, to_account_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          Number(payment.account_id),
          payment.category_id ? Number(payment.category_id) : null,
          payment.type,
          payment.amount,
          payment.next_date,
          payment.note ? `${payment.payee} — ${payment.note}` : payment.payee,
          new Date().toISOString(),
        ]
      );

      const nextDate = advanceByFrequency(payment.next_date, payment.frequency);
      if (nextDate) {
        await db.runAsync('UPDATE finance_planned_payments SET next_date = ? WHERE id = ?', [nextDate, Number(payment.id)]);
      } else {
        await db.runAsync('UPDATE finance_planned_payments SET is_active = 0 WHERE id = ?', [Number(payment.id)]);
      }
      await refresh();
      return nextDate;
    },
    [db, refresh]
  );

  const removePlannedPayment = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_planned_payments WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { plannedPayments, loading, refresh, addPlannedPayment, markPaid, removePlannedPayment };
}
