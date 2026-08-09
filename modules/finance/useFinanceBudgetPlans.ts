import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey, weekdayOf } from '@/lib/date';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

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

export function useFinanceBudgetPlans() {
  const db = useSQLiteContext();
  const [plans, setPlans] = useState<BudgetPlanProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<BudgetPlanRow>('SELECT * FROM finance_budget_plans WHERE is_active = 1 ORDER BY created_at ASC');
      const today = todayKey();

      const withProgress = await Promise.all(
        rows.map(async (row) => {
          const plan = toBudgetPlan(row);
          const { start, end } = periodWindow(plan, today);
          const clampedToday = today < start ? start : today > end ? end : today;

          const params: (string | number)[] = [start, end];
          let categoryClause = '';
          if (plan.category_id) {
            categoryClause = 'AND category_id = ?';
            params.push(Number(plan.category_id));
          }
          const spentRow = await db.getFirstAsync<{ total: number | null }>(
            `SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ? AND date <= ? ${categoryClause}`,
            params
          );
          const spent = spentRow?.total ?? 0;

          const daysInPeriod = daysBetween(start, end);
          const daysElapsed = Math.min(Math.max(daysBetween(start, clampedToday), 1), daysInPeriod);
          const forecastSpend = (spent / daysElapsed) * daysInPeriod;

          const progress: BudgetPlanProgress = {
            ...plan,
            spent,
            daysElapsed,
            daysInPeriod,
            forecastSpend,
            status: statusFor(spent, plan.amount, forecastSpend),
          };
          return progress;
        })
      );

      setPlans(withProgress);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addBudgetPlan = useCallback(
    async (values: { name: string; period: BudgetPeriod; amount: number; categoryId?: string | null; startDate?: string | null; endDate?: string | null }) => {
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO finance_budget_plans (name, period, amount, category_id, start_date, end_date, is_active, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
        [
          values.name,
          values.period,
          values.amount,
          values.categoryId ? Number(values.categoryId) : null,
          values.startDate ?? null,
          values.endDate ?? null,
          now,
          now,
          Crypto.randomUUID(),
        ]
      );
      await pushLocalRow(db, 'finance_budget_plans', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const editBudgetPlan = useCallback(
    async (
      id: string,
      values: Partial<{ name: string; period: BudgetPeriod; amount: number; categoryId: string | null; startDate: string | null; endDate: string | null }>
    ) => {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      if (values.name !== undefined) {
        updates.push('name = ?');
        params.push(values.name);
      }
      if (values.period !== undefined) {
        updates.push('period = ?');
        params.push(values.period);
      }
      if (values.amount !== undefined) {
        updates.push('amount = ?');
        params.push(values.amount);
      }
      if (values.categoryId !== undefined) {
        updates.push('category_id = ?');
        params.push(values.categoryId ? Number(values.categoryId) : null);
      }
      if (values.startDate !== undefined) {
        updates.push('start_date = ?');
        params.push(values.startDate);
      }
      if (values.endDate !== undefined) {
        updates.push('end_date = ?');
        params.push(values.endDate);
      }
      if (updates.length === 0) return;
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(Number(id));
      await db.runAsync(`UPDATE finance_budget_plans SET ${updates.join(', ')} WHERE id = ?`, params);
      await pushLocalRow(db, 'finance_budget_plans', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const removeBudgetPlan = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving(db, 'finance_budget_plans', Number(id));
      await db.runAsync('DELETE FROM finance_budget_plans WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { plans, loading, refresh, addBudgetPlan, editBudgetPlan, removeBudgetPlan };
}
