import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { MOOD_SCORE } from '@/modules/analytics';

import { periodStartsFromLogs, phaseForDate, type CyclePhase } from './predictNextPeriod';
import { useCycleLogs } from './useCycleLogs';
import { useCyclePreferences } from './useCyclePreferences';

type CheckinRow = { date: string; type: 'morning' | 'night'; energy: number | null; stress: number | null; mood: string | null };

export type PhaseAverages = Record<CyclePhase, { energy: number | null; stress: number | null; mood: number | null; days: number }>;

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

/** Web build of useCycleMoodCorrelation.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of the native useFocusEffect-based refresh: any write to journal_checkins,
 * cycle_logs, or cycle_preferences in any tab (or from the sync engine) automatically recomputes
 * the phase buckets everywhere this hook is mounted. `refresh` is kept as a no-op-returning
 * function only so callers that `await refresh()` don't need changing. */
export function useCycleMoodCorrelation() {
  const { logs: cycleLogs, loading: logsLoading } = useCycleLogs();
  const { averageCycleLength, averagePeriodLength, loading: prefsLoading } = useCyclePreferences();

  const averages = useLiveQuery(async () => {
    if (logsLoading || prefsLoading) return undefined;

    const periodStartDates = periodStartsFromLogs(cycleLogs);
    if (periodStartDates.length === 0) return null;

    const rows = (await webDb.journal_checkins.toArray()) as unknown as CheckinRow[];

    const byPhase: Record<CyclePhase, { energy: number[]; stress: number[]; mood: number[]; dates: Set<string> }> = {
      menstrual: { energy: [], stress: [], mood: [], dates: new Set() },
      follicular: { energy: [], stress: [], mood: [], dates: new Set() },
      ovulation: { energy: [], stress: [], mood: [], dates: new Set() },
      luteal: { energy: [], stress: [], mood: [], dates: new Set() },
    };

    for (const row of rows) {
      const phase = phaseForDate(row.date, periodStartDates, averageCycleLength, averagePeriodLength);
      if (!phase) continue;
      byPhase[phase].dates.add(row.date);
      if (row.type === 'morning') {
        if (row.energy != null) byPhase[phase].energy.push(row.energy);
        if (row.stress != null) byPhase[phase].stress.push(row.stress);
      } else if (row.mood) {
        const score = MOOD_SCORE[row.mood];
        if (score != null) byPhase[phase].mood.push(score);
      }
    }

    const result = {} as PhaseAverages;
    for (const phase of PHASES) {
      const bucket = byPhase[phase];
      result[phase] = {
        energy: average(bucket.energy),
        stress: average(bucket.stress),
        mood: average(bucket.mood),
        days: bucket.dates.size,
      };
    }
    return result;
  }, [cycleLogs, logsLoading, averageCycleLength, averagePeriodLength, prefsLoading]);

  const loading = logsLoading || prefsLoading || averages === undefined;

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  return { averages: averages ?? null, loading, refresh };
}
