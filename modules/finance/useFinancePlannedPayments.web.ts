import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

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
  updated_at?: string;
  sync_id?: string;
  is_subscription: number;
  remind_days_before: number;
};

/** Mirrors finance_planned_payments' `CHECK (amount > 0)` (db/schema.ts) — SQLite would reject
 * a violating insert/update; IndexedDB has no such guard, and markPaid below feeds this value
 * straight into a finance_transactions insert (itself CHECK-guarded natively) and a balance
 * delta, so an unguarded non-positive amount would corrupt current_balance with no error. */
function assertPositiveAmount(amount: number): void {
  if (!(amount > 0)) throw new Error('Amount must be greater than 0.');
}

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
    is_subscription: !!row.is_subscription,
    remind_days_before: row.remind_days_before,
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

/**
 * Web build of useFinancePlannedPayments.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a write from any tab (or the sync
 * engine's merge) makes every mounted instance re-render automatically.
 */
export function useFinancePlannedPayments() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_planned_payments.toArray()) as PlannedPaymentRow[];
    return all
      .filter((row) => !!row.is_active)
      .sort((a, b) => (a.next_date < b.next_date ? -1 : a.next_date > b.next_date ? 1 : 0));
  }, []);

  const loading = rows === undefined;
  const plannedPayments = (rows ?? []).map(toPlannedPayment);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

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
      isSubscription?: boolean;
      remindDaysBefore?: number;
    }) => {
      assertPositiveAmount(values.amount);
      const now = new Date().toISOString();
      const id = (await webDb.finance_planned_payments.add({
        account_id: Number(values.accountId),
        category_id: values.categoryId ? Number(values.categoryId) : null,
        type: values.type,
        amount: values.amount,
        payee: values.payee,
        frequency: values.frequency,
        next_date: values.nextDate,
        notify: values.notify ? 1 : 0,
        note: values.note ?? null,
        is_active: 1,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
        is_subscription: values.isSubscription ? 1 : 0,
        remind_days_before: values.remindDaysBefore ?? 0,
      } as never)) as number;
      await pushLocalRow('finance_planned_payments', id);
      return String(id);
    },
    []
  );

  /** Records the actual transaction this planned payment represents, then either advances it to
   * its next occurrence (recurring) or deactivates it (one-time) — a manual action, since Flowsy
   * has no background scheduler to post transactions on its own. Returns the new next_date (for
   * the caller to reschedule its reminder) or null if the payment is now fully done. */
  const markPaid = useCallback(async (payment: PlannedPayment): Promise<string | null> => {
    assertPositiveAmount(payment.amount);
    const now = new Date().toISOString();
    const nextDate = advanceByFrequency(payment.next_date, payment.frequency);

    await webDb.transaction('rw', [webDb.finance_transactions, webDb.finance_accounts, webDb.finance_planned_payments], async () => {
      const txId = (await webDb.finance_transactions.add({
        account_id: Number(payment.account_id),
        category_id: payment.category_id ? Number(payment.category_id) : null,
        type: payment.type,
        amount: payment.amount,
        date: payment.next_date,
        note: payment.note ? `${payment.payee} — ${payment.note}` : payment.payee,
        to_account_id: null,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
      } as never)) as number;

      // Replicates SQL trigger trg_finance_tx_insert (db/schema.ts): for a non-transfer
      // transaction, current_balance += amount for 'income', -= amount for 'expense'. Planned
      // payments are always 'income' or 'expense', never 'transfer', so the to_account_id branch
      // of the trigger never applies here.
      const account = await webDb.finance_accounts.get(Number(payment.account_id));
      if (account) {
        const delta = payment.type === 'income' ? payment.amount : -payment.amount;
        await webDb.finance_accounts.update(Number(payment.account_id), {
          current_balance: (account.current_balance as number) + delta,
          updated_at: now,
        });
      }

      if (nextDate) {
        await webDb.finance_planned_payments.update(Number(payment.id), { next_date: nextDate, updated_at: now });
      } else {
        await webDb.finance_planned_payments.update(Number(payment.id), { is_active: 0, updated_at: now });
      }

      await pushLocalRow('finance_transactions', txId);
      // The transaction insert trigger recomputes finance_accounts.current_balance directly via
      // SQL — push the affected account too so the recalculated balance syncs.
      await pushLocalRow('finance_accounts', Number(payment.account_id));
      await pushLocalRow('finance_planned_payments', Number(payment.id));
    });

    return nextDate;
  }, []);

  const editPlannedPayment = useCallback(
    async (
      id: string,
      values: Partial<{
        accountId: string;
        categoryId: string | null;
        type: 'income' | 'expense';
        amount: number;
        payee: string;
        frequency: PlannedPaymentFrequency;
        nextDate: string;
        notify: boolean;
        note: string | null;
        isSubscription: boolean;
        remindDaysBefore: number;
      }>
    ) => {
      const updates: Record<string, unknown> = {};
      if (values.accountId !== undefined) updates.account_id = Number(values.accountId);
      if (values.categoryId !== undefined) updates.category_id = values.categoryId ? Number(values.categoryId) : null;
      if (values.type !== undefined) updates.type = values.type;
      if (values.amount !== undefined) {
        assertPositiveAmount(values.amount);
        updates.amount = values.amount;
      }
      if (values.payee !== undefined) updates.payee = values.payee;
      if (values.frequency !== undefined) updates.frequency = values.frequency;
      if (values.nextDate !== undefined) updates.next_date = values.nextDate;
      if (values.notify !== undefined) updates.notify = values.notify ? 1 : 0;
      if (values.note !== undefined) updates.note = values.note;
      if (values.isSubscription !== undefined) updates.is_subscription = values.isSubscription ? 1 : 0;
      if (values.remindDaysBefore !== undefined) updates.remind_days_before = values.remindDaysBefore;
      if (Object.keys(updates).length === 0) return;
      updates.updated_at = new Date().toISOString();
      await webDb.finance_planned_payments.update(Number(id), updates);
      await pushLocalRow('finance_planned_payments', Number(id));
    },
    []
  );

  const removePlannedPayment = useCallback(async (id: string) => {
    await recordDeleteBeforeRemoving('finance_planned_payments', Number(id));
    await webDb.finance_planned_payments.delete(Number(id));
  }, []);

  return { plannedPayments, loading, refresh, addPlannedPayment, editPlannedPayment, markPaid, removePlannedPayment };
}
