import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';

export type FinanceBudgets = {
  weeklyBudget: number | null;
  monthlyBudget: number | null;
};

export function useFinanceBudgets() {
  const row = useLiveQuery(
    () =>
      webDb.finance_budgets.get(1) as Promise<
        { weekly_budget: number | null; monthly_budget: number | null } | undefined
      >,
    []
  );

  const loading = row === undefined;
  const budgets: FinanceBudgets | null = loading
    ? null
    : { weeklyBudget: row?.weekly_budget ?? null, monthlyBudget: row?.monthly_budget ?? null };

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const setBudgets = useCallback(
    async (values: Partial<FinanceBudgets>) => {
      const next = { ...(budgets ?? {}), ...values };
      // .put(), not .update() — webDb.on('populate') seeds this row for every new install, but
      // .update() is update-only in Dexie (silently no-ops if the key is somehow still absent,
      // e.g. a user who loaded once before the populate-seed fix shipped); .put() always writes.
      // sync_id included because put() fully replaces the row — omitting it would wipe the
      // seeded 'singleton' sync_id and permanently stop this table from syncing cross-device.
      await webDb.finance_budgets.put({
        id: 1,
        weekly_budget: next.weeklyBudget ?? null,
        monthly_budget: next.monthlyBudget ?? null,
        updated_at: new Date().toISOString(),
        sync_id: 'singleton',
      } as never);
      await pushLocalRow('finance_budgets', 1);
    },
    [budgets]
  );

  return { budgets, loading, setBudgets, refresh };
}
