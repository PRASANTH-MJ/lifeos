import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

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

/** Buckets journal check-ins by cycle phase rather than by day — "average mood/energy/stress
 * during your luteal phase" instead of a day-by-day series, since the phase is the axis someone
 * actually wants to see this compared against. Reuses the same MOOD_SCORE numeric mapping the
 * rest of Analytics already scores mood on (modules/analytics/useCheckinTrends.ts), so this
 * reads consistently with the mood numbers shown everywhere else in the app. */
export function useCycleMoodCorrelation() {
  const db = useSQLiteContext();
  const { logs: cycleLogs, loading: logsLoading } = useCycleLogs();
  const { averageCycleLength, averagePeriodLength, loading: prefsLoading } = useCyclePreferences();
  const [averages, setAverages] = useState<PhaseAverages | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (logsLoading || prefsLoading) return;
    setLoading(true);
    try {
      const periodStartDates = periodStartsFromLogs(cycleLogs);
      if (periodStartDates.length === 0) {
        setAverages(null);
        return;
      }

      const rows = await db.getAllAsync<CheckinRow>('SELECT date, type, energy, stress, mood FROM journal_checkins');

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
      setAverages(result);
    } finally {
      setLoading(false);
    }
  }, [db, cycleLogs, logsLoading, averageCycleLength, averagePeriodLength, prefsLoading]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { averages, loading: loading || logsLoading || prefsLoading, refresh };
}
