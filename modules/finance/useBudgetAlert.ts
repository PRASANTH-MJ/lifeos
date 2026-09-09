import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, todayKey, weekdayOf } from '@/lib/date';

const ALERT_THRESHOLD = 0.9;

type BudgetAlert = { label: 'weekly' | 'monthly'; spent: number; budget: number; percent: number };

/** Flags when weekly or monthly spend has crossed 90% of the budget set on the Finance home
 * screen — surfaced globally (see AiAssistantFab) rather than only inside Finance Tracker, since
 * a near-limit warning is more useful caught early than found next time the user happens to open
 * the finance tab. */
export function useBudgetAlert() {
  const db = useSQLiteContext();
  const [alert, setAlert] = useState<BudgetAlert | null>(null);
  // Unconditional current-period spend/budget snapshot — unlike `alert`, populated whenever a
  // budget is set at all, not just once spend crosses ALERT_THRESHOLD. Added for the Life
  // Scoreboard's Financial score (see modules/scoreboard/useLifeScore.ts), which needs the real
  // percent used even when comfortably under budget, not just a near-limit warning.
  const [current, setCurrent] = useState<BudgetAlert | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const budgetsRow = await db.getFirstAsync<{ weekly_budget: number | null; monthly_budget: number | null }>(
        'SELECT weekly_budget, monthly_budget FROM finance_budgets WHERE id = 1'
      );
      const today = todayKey();
      const weekStart = addDays(today, -weekdayOf(today));
      const monthStart = `${today.slice(0, 7)}-01`;

      const [weekRow, monthRow] = await Promise.all([
        db.getFirstAsync<{ total: number | null }>(
          "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ?",
          [weekStart]
        ),
        db.getFirstAsync<{ total: number | null }>(
          "SELECT SUM(amount) as total FROM finance_transactions WHERE type = 'expense' AND date >= ?",
          [monthStart]
        ),
      ]);

      const weekSpent = weekRow?.total ?? 0;
      const monthSpent = monthRow?.total ?? 0;
      const weeklyBudget = budgetsRow?.weekly_budget ?? null;
      const monthlyBudget = budgetsRow?.monthly_budget ?? null;

      let next: BudgetAlert | null = null;
      if (monthlyBudget && monthSpent / monthlyBudget >= ALERT_THRESHOLD) {
        next = { label: 'monthly', spent: monthSpent, budget: monthlyBudget, percent: Math.round((monthSpent / monthlyBudget) * 100) };
      } else if (weeklyBudget && weekSpent / weeklyBudget >= ALERT_THRESHOLD) {
        next = { label: 'weekly', spent: weekSpent, budget: weeklyBudget, percent: Math.round((weekSpent / weeklyBudget) * 100) };
      }
      setAlert(next);

      // Prefer monthly when both are set — same priority order as the threshold check above.
      setCurrent(
        monthlyBudget
          ? { label: 'monthly', spent: monthSpent, budget: monthlyBudget, percent: Math.round((monthSpent / monthlyBudget) * 100) }
          : weeklyBudget
            ? { label: 'weekly', spent: weekSpent, budget: weeklyBudget, percent: Math.round((weekSpent / weeklyBudget) * 100) }
            : null
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { alert, current, loading, refresh };
}
