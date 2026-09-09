import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';

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

type CheckinRow = {
  date: string;
  type: 'morning' | 'night';
  energy: number | null;
  stress: number | null;
  productivity: number | null;
  mood: string | null;
};

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function seriesFor(rows: { date: string; value: number | null }[]): Series {
  return rows.filter((row) => row.value != null).map((row) => ({ date: row.date, value: row.value as number })) as Series;
}

/**
 * Web build of useCheckinTrends.ts — same exported shape. Reactive via useLiveQuery over the
 * three source tables (journal_checkins, habit_logs, journal_entries) instead of the native
 * version's useFocusEffect-triggered refresh; any write in this tab or another re-runs the
 * query and recomputes the trends automatically.
 */
export function useCheckinTrends(days: number) {
  const trends = useLiveQuery(async (): Promise<CheckinTrends> => {
    const start = addDays(todayKey(), -(days - 1));
    const prevStart = addDays(start, -days);
    const prevEnd = addDays(start, -1);

    const [allCheckins, allHabitLogs, allJournalEntries] = await Promise.all([
      webDb.journal_checkins.toArray() as unknown as Promise<CheckinRow[]>,
      webDb.habit_logs.toArray() as unknown as Promise<{ date: string }[]>,
      webDb.journal_entries.toArray() as unknown as Promise<{ created_at: string }[]>,
    ]);

    const currentRows = allCheckins.filter((r) => r.date >= start);
    const previousRows = allCheckins.filter((r) => r.date >= prevStart && r.date <= prevEnd);
    const habitLogCount = allHabitLogs.filter((r) => r.date >= start).length;
    const reflectionCount = allJournalEntries.filter((r) => r.created_at.slice(0, 10) >= start).length;

    const stressSeries = seriesFor(currentRows.filter((r) => r.type === 'morning').map((r) => ({ date: r.date, value: r.stress })));
    const energySeries = seriesFor(currentRows.filter((r) => r.type === 'morning').map((r) => ({ date: r.date, value: r.energy })));
    const productivitySeries = seriesFor(currentRows.filter((r) => r.type === 'night').map((r) => ({ date: r.date, value: r.productivity })));
    const joySeries = seriesFor(
      currentRows.filter((r) => r.type === 'night').map((r) => ({ date: r.date, value: r.mood ? MOOD_SCORE[r.mood] ?? null : null }))
    );

    const prevMorning = previousRows.filter((r) => r.stress != null || r.energy != null);
    const prevNight = previousRows.filter((r) => r.productivity != null || r.mood != null);

    return {
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
        habitLogs: habitLogCount,
        reflections: reflectionCount,
      },
    };
  }, [days]);

  const loading = trends === undefined;

  const refresh = useMemo(
    () => async () => {
      // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
    },
    []
  );

  return { trends: trends ?? null, loading, refresh };
}
