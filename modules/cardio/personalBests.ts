import { isDistanceActivity, type CardioActivity, type CardioLog } from './types';

export type CardioPersonalBest = {
  /** Longest single-session distance logged for this activity, in km — null if no distance has
   * ever been logged (activity isn't distance-based, or has no logs yet). */
  longestDistanceKm: number | null;
  /** Fastest average pace across a single session, in seconds per km (lower is faster) — null
   * under the same conditions as longestDistanceKm. Derived from distanceKm/durationMinutes, the
   * same average-pace math as formatPace/formatSpeedKmh, not a moment-to-moment GPS speed. */
  fastestPaceSecPerKm: number | null;
};

const EMPTY_BEST: CardioPersonalBest = { longestDistanceKm: null, fastestPaceSecPerKm: null };

/** Average pace in seconds/km for one logged session — null if there's nothing to divide by
 * (matches formatPace/formatSpeedKmh's zero-guard). */
function paceSecPerKm(distanceKm: number | null, durationMinutes: number): number | null {
  if (!distanceKm || distanceKm <= 0 || durationMinutes <= 0) return null;
  return (durationMinutes * 60) / distanceKm;
}

/** The best-ever distance/pace for one activity across every log passed in (already filtered to
 * that activity by the caller — this doesn't filter by `activity` itself, matching how the
 * [activity]/index.tsx screen already does its own `allLogs.filter` for the History section). */
export function computeCardioPersonalBest(logsForActivity: CardioLog[]): CardioPersonalBest {
  return logsForActivity.reduce<CardioPersonalBest>((best, log) => {
    const pace = paceSecPerKm(log.distanceKm, log.durationMinutes);
    return {
      longestDistanceKm: log.distanceKm != null && (best.longestDistanceKm == null || log.distanceKm > best.longestDistanceKm) ? log.distanceKm : best.longestDistanceKm,
      fastestPaceSecPerKm: pace != null && (best.fastestPaceSecPerKm == null || pace < best.fastestPaceSecPerKm) ? pace : best.fastestPaceSecPerKm,
    };
  }, EMPTY_BEST);
}

export type CardioPrResult = { isDistancePr: boolean; isPacePr: boolean };

/** Whether a just-finished session (not yet inserted into cardio_logs) beats the prior best for
 * its activity — call with the *existing* logs for that activity (pre-insert), so the new
 * session isn't compared against itself. Only meaningful for distance activities
 * (running/walking/hiking/cycling); other activities always report no PR here. */
export function checkCardioPr(
  activity: CardioActivity,
  priorLogsForActivity: CardioLog[],
  candidate: { distanceKm: number | null; durationMinutes: number }
): CardioPrResult {
  if (!isDistanceActivity(activity)) return { isDistancePr: false, isPacePr: false };
  const prior = computeCardioPersonalBest(priorLogsForActivity);
  const candidatePace = paceSecPerKm(candidate.distanceKm, candidate.durationMinutes);
  return {
    isDistancePr: candidate.distanceKm != null && candidate.distanceKm > 0 && (prior.longestDistanceKm == null || candidate.distanceKm > prior.longestDistanceKm),
    isPacePr: candidatePace != null && (prior.fastestPaceSecPerKm == null || candidatePace < prior.fastestPaceSecPerKm),
  };
}
