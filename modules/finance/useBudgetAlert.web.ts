import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { addDays, todayKey, weekdayOf } from '@/lib/date';

const ALERT_THRESHOLD = 0.9;

type BudgetAlert = { label: 'weekly' | 'monthly'; spent: number; budget: number; percent: number };

type BudgetsRow = { weekly_budget: number | null; monthly_budget: number | null };
type TransactionRow = { type: string; date: string; amount: number };

/** Web build of useBudgetAlert.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write to finance_budgets or finance_transactions
 * from any tab (or the sync engine) recomputes the alert everywhere automatically. */
export function useBudgetAlert() {
  // useLiveQuery only re-runs on a table write, never on wall-clock time alone. Native
  // recomputes weekStart/monthStart on every screen focus, catching a week/month boundary
  // crossing with zero transaction writes in between — replicate that with a periodic
  // re-check instead, since there's no route-focus equivalent for a hook that stays mounted.
  const [dayTick, setDayTick] = useState(todayKey());
  useEffect(() => {
    const check = () => setDayTick((current) => (current !== todayKey() ? todayKey() : current));
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const alert = useLiveQuery(async () => {
    const budgetsRow = (await webDb.finance_budgets.get(1)) as BudgetsRow | undefined;
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const monthStart = `${today.slice(0, 7)}-01`;

    const transactions = (await webDb.finance_transactions.toArray()) as TransactionRow[];

    const weekSpent = transactions
      .filter((t) => t.type === 'expense' && t.date >= weekStart)
      .reduce((sum, t) => sum + t.amount, 0);
    const monthSpent = transactions
      .filter((t) => t.type === 'expense' && t.date >= monthStart)
      .reduce((sum, t) => sum + t.amount, 0);

    const weeklyBudget = budgetsRow?.weekly_budget ?? null;
    const monthlyBudget = budgetsRow?.monthly_budget ?? null;

    let next: BudgetAlert | null = null;
    if (monthlyBudget && monthSpent / monthlyBudget >= ALERT_THRESHOLD) {
      next = { label: 'monthly', spent: monthSpent, budget: monthlyBudget, percent: Math.round((monthSpent / monthlyBudget) * 100) };
    } else if (weeklyBudget && weekSpent / weeklyBudget >= ALERT_THRESHOLD) {
      next = { label: 'weekly', spent: weekSpent, budget: weeklyBudget, percent: Math.round((weekSpent / weeklyBudget) * 100) };
    }
    return next;
  }, [dayTick]);

  // Unconditional current-period snapshot — see useBudgetAlert.ts's identical addition for why.
  const current = useLiveQuery(async () => {
    const budgetsRow = (await webDb.finance_budgets.get(1)) as BudgetsRow | undefined;
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const monthStart = `${today.slice(0, 7)}-01`;

    const transactions = (await webDb.finance_transactions.toArray()) as TransactionRow[];

    const weekSpent = transactions
      .filter((t) => t.type === 'expense' && t.date >= weekStart)
      .reduce((sum, t) => sum + t.amount, 0);
    const monthSpent = transactions
      .filter((t) => t.type === 'expense' && t.date >= monthStart)
      .reduce((sum, t) => sum + t.amount, 0);

    const weeklyBudget = budgetsRow?.weekly_budget ?? null;
    const monthlyBudget = budgetsRow?.monthly_budget ?? null;

    if (monthlyBudget) return { label: 'monthly' as const, spent: monthSpent, budget: monthlyBudget, percent: Math.round((monthSpent / monthlyBudget) * 100) };
    if (weeklyBudget) return { label: 'weekly' as const, spent: weekSpent, budget: weeklyBudget, percent: Math.round((weekSpent / weeklyBudget) * 100) };
    return null;
  }, [dayTick]);

  const loading = alert === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { alert: alert ?? null, current: current ?? null, loading, refresh };
}
