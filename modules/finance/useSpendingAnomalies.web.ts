import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { webDb } from '@/db/webDb';
import { addDays, todayKey, weekdayOf } from '@/lib/date';

import type { SpendingAnomaly } from './types';

const ANOMALY_THRESHOLD = 2;
const TRAILING_WEEKS = 4;
// Below this, a ratio spike is just noise from a single small purchase in an otherwise-unused
// category — not worth surfacing as "you're spending unusually" (e.g. $6 vs. a $2 average).
const MIN_CURRENT_SPEND = 20;

type TxRow = { type: string; date: string; amount: number; category_id: number | null };
type CategoryRow = { id: number; name: string };

/**
 * Web build of useSpendingAnomalies.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write to finance_transactions from any tab (or the
 * sync engine) re-runs this query automatically.
 */
export function useSpendingAnomalies() {
  const anomalies = useLiveQuery(async () => {
    const today = todayKey();
    const weekStart = addDays(today, -weekdayOf(today));
    const priorStart = addDays(weekStart, -7 * TRAILING_WEEKS);

    const [txRows, categoryRows] = await Promise.all([
      webDb.finance_transactions.toArray() as unknown as Promise<TxRow[]>,
      webDb.finance_categories.toArray() as unknown as Promise<CategoryRow[]>,
    ]);

    const nameById = new Map<number, string>();
    for (const category of categoryRows) nameById.set(category.id, category.name);

    const relevant = txRows.filter((row) => row.type === 'expense' && row.date >= priorStart && row.date <= today);

    // Replicates the native SQL's `GROUP BY category_id` + conditional SUMs.
    const totalsByCategory = new Map<string, { current: number; prior: number }>();
    for (const row of relevant) {
      const key = row.category_id != null ? String(row.category_id) : 'null';
      const entry = totalsByCategory.get(key) ?? { current: 0, prior: 0 };
      if (row.date >= weekStart) entry.current += row.amount;
      else entry.prior += row.amount;
      totalsByCategory.set(key, entry);
    }

    const next: SpendingAnomaly[] = [];
    for (const [key, totals] of totalsByCategory) {
      const average = totals.prior / TRAILING_WEEKS;
      if (average <= 0 || totals.current < MIN_CURRENT_SPEND) continue;
      const ratio = totals.current / average;
      if (ratio < ANOMALY_THRESHOLD) continue;
      const categoryId = key === 'null' ? null : Number(key);
      next.push({
        categoryId: categoryId != null ? String(categoryId) : null,
        categoryName: (categoryId != null ? nameById.get(categoryId) : null) ?? 'Uncategorized',
        current: totals.current,
        average,
        ratio,
      });
    }
    next.sort((a, b) => b.ratio - a.ratio);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { anomalies: anomalies ?? [], loading: anomalies === undefined, refresh };
}
