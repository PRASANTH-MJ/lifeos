import { addDays, todayKey } from '@/lib/date';
import type { CycleLog } from './useCycleLogs';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export type CyclePrediction = {
  /** Every period's first logged day, oldest first — a "start" is any flow-logged day not
   * immediately preceded by another flow-logged day, so a multi-day period only counts once. */
  periodStartDates: string[];
  /** Average gap between consecutive starts, in days — falls back to the user's stored
   * preference until at least 2 periods have been logged (1 gap isn't a trustworthy average). */
  averageCycleLength: number;
  nextPredictedStart: string | null;
  currentCycleDay: number | null;
  currentPhase: CyclePhase | null;
};

export function periodStartsFromLogs(logs: CycleLog[]): string[] {
  const flowDates = logs.filter((l) => l.flow).map((l) => l.date).sort();
  const starts: string[] = [];
  for (const date of flowDates) {
    const previousDay = addDays(date, -1);
    if (!flowDates.includes(previousDay)) starts.push(date);
  }
  return starts;
}

/** Classifies an arbitrary date (past or present) into a cycle phase, given the periods already
 * logged — used both for "today's phase" (predictNextPeriod below) and for tagging historical
 * journal check-in dates in useCycleMoodCorrelation. Returns null if the date falls before any
 * logged period start (nothing to classify it against). */
export function phaseForDate(date: string, periodStartDates: string[], cycleLength: number, periodLength: number): CyclePhase | null {
  const priorStarts = periodStartDates.filter((s) => s <= date);
  const start = priorStarts[priorStarts.length - 1];
  if (!start) return null;

  const cycleDay = Math.round((new Date(date).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const ovulationDay = cycleLength - 14;
  if (cycleDay <= periodLength) return 'menstrual';
  if (cycleDay < ovulationDay - 1) return 'follicular';
  if (cycleDay <= ovulationDay + 1) return 'ovulation';
  return 'luteal';
}

/** Plain date-math prediction, not a statistical/ML model — this is meant to be a rough,
 * explainable estimate ("your last few cycles average N days"), not a medical claim. */
export function predictNextPeriod(logs: CycleLog[], fallbackCycleLength: number, fallbackPeriodLength: number): CyclePrediction {
  const periodStartDates = periodStartsFromLogs(logs);

  let averageCycleLength = fallbackCycleLength;
  if (periodStartDates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < periodStartDates.length; i += 1) {
      const daysBetween = Math.round(
        (new Date(periodStartDates[i]).getTime() - new Date(periodStartDates[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysBetween > 0 && daysBetween < 90) gaps.push(daysBetween); // ignore obvious gaps/outliers
    }
    if (gaps.length > 0) averageCycleLength = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
  }

  const lastStart = periodStartDates[periodStartDates.length - 1] ?? null;
  if (!lastStart) {
    return { periodStartDates, averageCycleLength, nextPredictedStart: null, currentCycleDay: null, currentPhase: null };
  }

  const nextPredictedStart = addDays(lastStart, averageCycleLength);
  const today = todayKey();
  const daysSinceStart = Math.round((new Date(today).getTime() - new Date(lastStart).getTime()) / (1000 * 60 * 60 * 24));
  const currentCycleDay = daysSinceStart >= 0 ? daysSinceStart + 1 : null;
  const currentPhase = phaseForDate(today, periodStartDates, averageCycleLength, fallbackPeriodLength);

  return { periodStartDates, averageCycleLength, nextPredictedStart, currentCycleDay, currentPhase };
}
