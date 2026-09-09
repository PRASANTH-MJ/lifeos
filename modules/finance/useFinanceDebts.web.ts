import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

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

/** Mirrors finance_debts' CHECK constraints (db/schema.ts: `direction IN ('lent','borrowed')`,
 * `amount > 0`) — SQLite would reject a violating insert/update; IndexedDB has no such guard. */
function assertValidDebtShape(values: { direction?: DebtDirection; amount?: number }): void {
  if (values.direction !== undefined && values.direction !== 'lent' && values.direction !== 'borrowed') {
    throw new Error('direction must be "lent" or "borrowed"');
  }
  if (values.amount !== undefined && !(values.amount > 0)) {
    throw new Error('amount must be greater than 0');
  }
}

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

/** Web build of useFinanceDebts.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine's merge)
 * flows into every mounted instance automatically. `remaining` (amount minus payments logged so
 * far) is still computed at query time, replicating the native SQL's GROUP BY + SUM. */
export function useFinanceDebts() {
  const result = useLiveQuery(async () => {
    const [rows, paidRows] = await Promise.all([
      webDb.finance_debts.toArray() as unknown as Promise<DebtRow[]>,
      webDb.finance_debt_payments.toArray() as unknown as Promise<{ debt_id: number; amount: number }[]>,
    ]);

    // GROUP BY debt_id, SUM(amount)
    const paidByDebt: Record<string, number> = {};
    for (const row of paidRows) {
      const key = String(row.debt_id);
      paidByDebt[key] = (paidByDebt[key] ?? 0) + row.amount;
    }

    // ORDER BY is_closed ASC, created_at DESC
    const sortedRows = [...rows].sort((a, b) => {
      if (a.is_closed !== b.is_closed) return a.is_closed - b.is_closed;
      return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
    });

    const nextDebts = sortedRows.map(toDebt);
    const nextRemaining: Record<string, number> = {};
    for (const debt of nextDebts) {
      nextRemaining[debt.id] = debt.amount - (paidByDebt[debt.id] ?? 0);
    }
    return { debts: nextDebts, remainingById: nextRemaining };
  }, []);

  const loading = result === undefined;
  const debts = result?.debts ?? [];
  const remainingById = result?.remainingById ?? {};

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  const addDebt = async (values: { personName: string; direction: DebtDirection; amount: number; note?: string | null }) => {
    assertValidDebtShape({ direction: values.direction, amount: values.amount });
    const now = new Date().toISOString();
    const id = await webDb.finance_debts.add({
      person_name: values.personName,
      direction: values.direction,
      amount: values.amount,
      note: values.note ?? null,
      is_closed: 0,
      created_at: now,
      closed_at: null,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('finance_debts', id as number);
  };

  const editDebt = async (
    id: string,
    values: Partial<{ personName: string; direction: DebtDirection; amount: number; note: string | null }>
  ) => {
    assertValidDebtShape({ direction: values.direction, amount: values.amount });
    const updates: Record<string, unknown> = {};
    if (values.personName !== undefined) updates.person_name = values.personName;
    if (values.direction !== undefined) updates.direction = values.direction;
    if (values.amount !== undefined) updates.amount = values.amount;
    if (values.note !== undefined) updates.note = values.note;
    if (Object.keys(updates).length === 0) return;
    updates.updated_at = new Date().toISOString();
    await webDb.finance_debts.update(Number(id), updates);
    await pushLocalRow('finance_debts', Number(id));
  };

  const setClosed = async (id: string, isClosed: boolean) => {
    const now = new Date().toISOString();
    await webDb.finance_debts.update(Number(id), {
      is_closed: isClosed ? 1 : 0,
      closed_at: isClosed ? now : null,
      updated_at: now,
    });
    await pushLocalRow('finance_debts', Number(id));
  };

  const removeDebt = async (id: string) => {
    const debtId = Number(id);
    // Replaces `finance_debt_payments.debt_id REFERENCES finance_debts(id) ON DELETE CASCADE`
    // (db/schema.ts) — IndexedDB has no FK cascade, so every payment row must be explicitly
    // tombstoned/deleted here or it's orphaned forever.
    const payments = (await webDb.finance_debt_payments.where('debt_id').equals(debtId).toArray()) as { id: number }[];
    for (const payment of payments) {
      await recordDeleteBeforeRemoving('finance_debt_payments', payment.id);
      await webDb.finance_debt_payments.delete(payment.id);
    }

    await recordDeleteBeforeRemoving('finance_debts', debtId);
    await webDb.finance_debts.delete(debtId);
  };

  return { debts, remainingById, loading, refresh, addDebt, editDebt, setClosed, removeDebt };
}

export function useDebtPayments(debtId: string) {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_debt_payments
      .where('debt_id')
      .equals(Number(debtId))
      .toArray()) as { id: number; debt_id: number; amount: number; date: string; created_at: string }[];

    // ORDER BY date DESC, created_at DESC
    return [...all].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
    });
  }, [debtId]);

  const loading = rows === undefined;
  const payments: DebtPayment[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    debt_id: String(r.debt_id),
    amount: r.amount,
    date: r.date,
    created_at: r.created_at,
  }));

  const addPayment = async (amount: number, date: string) => {
    const now = new Date().toISOString();
    const id = await webDb.finance_debt_payments.add({
      debt_id: Number(debtId),
      amount,
      date,
      created_at: now,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('finance_debt_payments', id as number);
  };

  const removePayment = async (id: string) => {
    await recordDeleteBeforeRemoving('finance_debt_payments', Number(id));
    await webDb.finance_debt_payments.delete(Number(id));
  };

  return { payments, loading, addPayment, removePayment };
}
