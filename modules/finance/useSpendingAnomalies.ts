import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey, weekdayOf } from '@/lib/date';

import type { SpendingAnomaly } from './types';

const ANOMALY_THRESHOLD = 2;
const TRAILING_WEEKS = 4;
// Below this, a ratio spike is just noise from a single small purchase in an otherwise-unused
// category — not worth surfacing as "you're spending unusually" (e.g. $6 vs. a $2 average).
const MIN_CURRENT_SPEND = 20;

type CategoryTotalsRow = { category_id: number | null; category_name: string | null; current_total: number; prior_total: number };

/**
 * Flags expense categories where this week's spend has crossed `ANOMALY_THRESHOLD`x the average
 * of the trailing `TRAILING_WEEKS` weeks before it — a simple, fully client-side comparison over
 * data that's already synced locally (finance_transactions), not a new backend signal.
 */
export function useSpendingAnomalies() {
  const db = useSQLiteContext();
  const [anomalies, setAnomalies] = useState<SpendingAnomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayKey();
      const weekStart = addDays(today, -weekdayOf(today));
      const priorStart = addDays(weekStart, -7 * TRAILING_WEEKS);

      const rows = await db.getAllAsync<CategoryTotalsRow>(
        `SELECT
           t.category_id as category_id,
           c.name as category_name,
           SUM(CASE WHEN t.date >= ? THEN t.amount ELSE 0 END) as current_total,
           SUM(CASE WHEN t.date < ? THEN t.amount ELSE 0 END) as prior_total
         FROM finance_transactions t
         LEFT JOIN finance_categories c ON c.id = t.category_id
         WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
         GROUP BY t.category_id`,
        [weekStart, weekStart, priorStart, today]
      );

      const next: SpendingAnomaly[] = [];
      for (const row of rows) {
        const average = row.prior_total / TRAILING_WEEKS;
        if (average <= 0 || row.current_total < MIN_CURRENT_SPEND) continue;
        const ratio = row.current_total / average;
        if (ratio < ANOMALY_THRESHOLD) continue;
        next.push({
          categoryId: row.category_id != null ? String(row.category_id) : null,
          categoryName: row.category_name ?? 'Uncategorized',
          current: row.current_total,
          average,
          ratio,
        });
      }
      next.sort((a, b) => b.ratio - a.ratio);
      setAnomalies(next);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { anomalies, loading, refresh };
}
