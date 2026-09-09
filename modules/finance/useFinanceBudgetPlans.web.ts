import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, todayKey, weekdayOf } from '@/lib/date';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

import type { BudgetPeriod, BudgetPlan, BudgetPlanProgress, BudgetStatus } from './types';

type BudgetPlanRow = {
  id: number;
  name: string;
  period: BudgetPeriod;
  amount: number;
  category_id: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
};

type FinanceTransactionRow = {
  type: string;
  date: string;
  amount: number;
  category_id: number | null;
};

function toBudgetPlan(row: BudgetPlanRow): BudgetPlan {
  return {
    id: String(row.id),
    name: row.name,
    period: row.period,
    amount: row.amount,
    category_id: row.category_id != null ? String(row.category_id) : null,
    start_date: row.start_date,
    end_date: row.end_date,
    is_active: !!row.is_active,
    created_at: row.created_at,
  };
}

function daysBetween(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** The current window [start, end] a budget plan is being measured against — recurring periods
 * always anchor to today's real calendar week/month/year; one-time budgets use their own dates. */
function periodWindow(plan: Pick<BudgetPlan, 'period' | 'start_date' | 'end_date'>, today: string): { start: string; end: string } {
  if (plan.period === 'weekly') {
    const start = addDays(today, -weekdayOf(today));
    return { start, end: addDays(start, 6) };
  }
  if (plan.period === 'monthly') {
    const [year, month] = today.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}` };
  }
  if (plan.period === 'yearly') {
    const year = today.slice(0, 4);
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return { start: plan.start_date ?? today, end: plan.end_date ?? today };
}

function statusFor(spent: number, amount: number, forecastSpend: number): BudgetStatus {
  if (spent > amount) return 'over_budget';
  if (forecastSpend > amount) return 'trending_over';
  return 'on_track';
}

/**
 * Web build of useFinanceBudgetPlans.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery: reads both finance_budget_plans and finance_transactions on every underlying
 * write to either table (in this tab or any other), replacing the native version's
 * useFocusEffect-triggered refresh() with automatic multi-tab-aware recomputation. The original
 * SQL query (`WHERE is_active = 1 ORDER BY created_at ASC`, plus a per-plan
 * `SUM(amount) WHERE type='expense' AND date BETWEEN ? AND ? [AND category_id = ?]`) is
 * replicated as a plain-JS filter/sort + reduce below.
 */
export function useFinanceBudgetPlans() {
  const plans = useLiveQuery(async () => {
    const [planRows, txRows] = await Promise.all([
      webDb.finance_budget_plans.toArray() as unknown as Promise<BudgetPlanRow[]>,
      webDb.finance_transactions.toArray() as unknown as Promise<FinanceTransactionRow[]>,
    ]);

    const activePlanRows = planRows
      .filter((row) => !!row.is_active)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

    const today = todayKey();

    return activePlanRows.map((row): BudgetPlanProgress => {
      const plan = toBudgetPlan(row);
      const { start, end } = periodWindow(plan, today);
      const clampedToday = today < start ? start : today > end ? end : today;

      const spent = txRows.reduce((sum, tx) => {
        if (tx.type !== 'expense') return sum;
        if (tx.date < start || tx.date > end) return sum;
        if (plan.category_id != null && String(tx.category_id) !== plan.category_id) return sum;
        return sum + tx.amount;
      }, 0);

      const daysInPeriod = daysBetween(start, end);
      const daysElapsed = Math.min(Math.max(daysBetween(start, clampedToday), 1), daysInPeriod);
      const forecastSpend = (spent / daysElapsed) * daysInPeriod;

      return {
        ...plan,
        spent,
        daysElapsed,
        daysInPeriod,
        forecastSpend,
        status: statusFor(spent, plan.amount, forecastSpend),
      };
    });
  }, []);

  const loading = plans === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  const addBudgetPlan = useCallback(
    async (values: { name: string; period: BudgetPeriod; amount: number; categoryId?: string | null; startDate?: string | null; endDate?: string | null }) => {
      const now = new Date().toISOString();
      const id = await webDb.finance_budget_plans.add({
        name: values.name,
        period: values.period,
        amount: values.amount,
        category_id: values.categoryId ? Number(values.categoryId) : null,
        start_date: values.startDate ?? null,
        end_date: values.endDate ?? null,
        is_active: 1,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
      } as never);
      await pushLocalRow('finance_budget_plans', id as number);
    },
    []
  );

  const editBudgetPlan = useCallback(
    async (
      id: string,
      values: Partial<{ name: string; period: BudgetPeriod; amount: number; categoryId: string | null; startDate: string | null; endDate: string | null }>
    ) => {
      const updates: Record<string, unknown> = {};
      if (values.name !== undefined) updates.name = values.name;
      if (values.period !== undefined) updates.period = values.period;
      if (values.amount !== undefined) updates.amount = values.amount;
      if (values.categoryId !== undefined) updates.category_id = values.categoryId ? Number(values.categoryId) : null;
      if (values.startDate !== undefined) updates.start_date = values.startDate;
      if (values.endDate !== undefined) updates.end_date = values.endDate;
      if (Object.keys(updates).length === 0) return;
      updates.updated_at = new Date().toISOString();
      await webDb.finance_budget_plans.update(Number(id), updates);
      await pushLocalRow('finance_budget_plans', Number(id));
    },
    []
  );

  const removeBudgetPlan = useCallback(async (id: string) => {
    await recordDeleteBeforeRemoving('finance_budget_plans', Number(id));
    await webDb.finance_budget_plans.delete(Number(id));
  }, []);

  return { plans: plans ?? [], loading, refresh, addBudgetPlan, editBudgetPlan, removeBudgetPlan };
}
