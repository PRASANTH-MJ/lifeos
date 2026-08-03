import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { addDays, todayKey } from '@/lib/date';

import { MOOD_SCORE } from './useDashboard';

type Series = { date: string; value: number }[];

export type MetricTrend = {
  series: Series;
  average: number | null;
  previousAverage: number | null;
};

export type CheckinTrends = {
  stress: MetricTrend;
  energy: MetricTrend;
  joy: MetricTrend;
  productivity: MetricTrend;
  stats: { checkins: number; habitLogs: number; reflections: number };
};

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function seriesFor(rows: { date: string; value: number | null }[]): Series {
  return rows.filter((row) => row.value != null).map((row) => ({ date: row.date, value: row.value as number })) as Series;
}

/**
 * Powers the Analytics "Trends" section — Stress/Energy (from morning check-ins), Joy (the
 * night check-in's mood, scored via the same MOOD_SCORE map the rest of Analytics already
 * uses), and Productivity (from night check-ins). Series are sparse (only days with an actual
 * check-in) rather than zero-filled like buildDailySeries — a day with no check-in isn't a
 * "0", it's just missing, and zero-filling would draw a misleading drop on the sparkline.
 */
export function useCheckinTrends(days: number) {
  const db = useSQLiteContext();
  const [trends, setTrends] = useState<CheckinTrends | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const start = addDays(todayKey(), -(days - 1));
      const prevStart = addDays(start, -days);
      const prevEnd = addDays(start, -1);

      const [currentRows, previousRows, habitLogRow, reflectionRow] = await Promise.all([
        db.getAllAsync<{ date: string; type: 'morning' | 'night'; energy: number | null; stress: number | null; productivity: number | null; mood: string | null }>(
          'SELECT date, type, energy, stress, productivity, mood FROM journal_checkins WHERE date >= ?',
          [start]
        ),
        db.getAllAsync<{ energy: number | null; stress: number | null; productivity: number | null; mood: string | null }>(
          'SELECT energy, stress, productivity, mood FROM journal_checkins WHERE date BETWEEN ? AND ?',
          [prevStart, prevEnd]
        ),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM habit_logs WHERE date >= ?', [start]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM journal_entries WHERE substr(created_at, 1, 10) >= ?', [start]),
      ]);

      const stressSeries = seriesFor(currentRows.filter((r) => r.type === 'morning').map((r) => ({ date: r.date, value: r.stress })));
      const energySeries = seriesFor(currentRows.filter((r) => r.type === 'morning').map((r) => ({ date: r.date, value: r.energy })));
      const productivitySeries = seriesFor(currentRows.filter((r) => r.type === 'night').map((r) => ({ date: r.date, value: r.productivity })));
      const joySeries = seriesFor(
        currentRows.filter((r) => r.type === 'night').map((r) => ({ date: r.date, value: r.mood ? MOOD_SCORE[r.mood] ?? null : null }))
      );

      const prevMorning = previousRows.filter((r) => r.stress != null || r.energy != null);
      const prevNight = previousRows.filter((r) => r.productivity != null || r.mood != null);

      setTrends({
        stress: {
          series: stressSeries,
          average: average(stressSeries.map((p) => p.value)),
          previousAverage: average(prevMorning.map((r) => r.stress).filter((v): v is number => v != null)),
        },
        energy: {
          series: energySeries,
          average: average(energySeries.map((p) => p.value)),
          previousAverage: average(prevMorning.map((r) => r.energy).filter((v): v is number => v != null)),
        },
        productivity: {
          series: productivitySeries,
          average: average(productivitySeries.map((p) => p.value)),
          previousAverage: average(prevNight.map((r) => r.productivity).filter((v): v is number => v != null)),
        },
        joy: {
          series: joySeries,
          average: average(joySeries.map((p) => p.value)),
          previousAverage: average(
            prevNight.map((r) => (r.mood ? MOOD_SCORE[r.mood] : null)).filter((v): v is number => v != null)
          ),
        },
        stats: {
          checkins: currentRows.length,
          habitLogs: habitLogRow?.count ?? 0,
          reflections: reflectionRow?.count ?? 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { trends, loading, refresh };
}
