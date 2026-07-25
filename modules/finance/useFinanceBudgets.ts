import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

export type FinanceBudgets = {
  weeklyBudget: number | null;
  monthlyBudget: number | null;
};

export function useFinanceBudgets() {
  const db = useSQLiteContext();
  const [budgets, setBudgets] = useState<FinanceBudgets | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<{ weekly_budget: number | null; monthly_budget: number | null }>(
      'SELECT weekly_budget, monthly_budget FROM finance_budgets WHERE id = 1'
    );
    setBudgets({ weeklyBudget: row?.weekly_budget ?? null, monthlyBudget: row?.monthly_budget ?? null });
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setBudgets_ = useCallback(
    async (values: Partial<FinanceBudgets>) => {
      const next = { ...budgets, ...values };
      await db.runAsync('UPDATE finance_budgets SET weekly_budget = ?, monthly_budget = ?, updated_at = ? WHERE id = 1', [
        next.weeklyBudget ?? null,
        next.monthlyBudget ?? null,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, budgets, refresh]
  );

  return { budgets, loading, setBudgets: setBudgets_, refresh };
}
