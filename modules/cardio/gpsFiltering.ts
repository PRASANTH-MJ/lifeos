import type { CardioActivity } from './types';

/** Horizontal accuracy (meters) above which a fix is almost certainly a "jumped through a
 * building" spike rather than a real position — expo-location's `coords.accuracy` is the radius
 * (68% confidence) of the reported fix, and BestForNavigation fixes routinely land well under
 * this even in tricky terrain, so 20m comfortably rejects only the bad ones without discarding
 * normal urban-canyon noise. */
export const MAX_ACCURACY_METERS = 20;

/** True when a fix's accuracy is good enough to trust for route/distance purposes. A fix with no
 * accuracy reported at all (some devices/platforms omit it) is let through rather than rejected
 * on missing data — only a reported value over the threshold is treated as bad. */
export function isAcceptableAccuracy(accuracy: number | null | undefined): boolean {
  return accuracy == null || accuracy <= MAX_ACCURACY_METERS;
}

/** Per-activity realistic top speed (km/h) used to reject GPS "teleport" spikes between
 * consecutive fixes — only activities that can actually be GPS-recorded (see GPS_RECORDABLE in
 * types.ts) need an entry here; anything else falls back to DEFAULT_MAX_SPEED_KMH. Cycling gets
 * its own higher ceiling since a road/downhill cyclist can comfortably clear the running/walking/
 * hiking bound below. */
export const MAX_SPEED_KMH_BY_ACTIVITY: Partial<Record<CardioActivity, number>> = {
  cycling: 60,
};

/** Safe upper bound (km/h) for running/walking/hiking, and the default for any activity not
 * listed in MAX_SPEED_KMH_BY_ACTIVITY — well beyond even a fast sprint, so it only ever catches
 * genuine bad fixes (signal bounce, cold-start jump), not real effort. */
export const DEFAULT_MAX_SPEED_KMH = 25;

export function maxSpeedMpsFor(activity: CardioActivity): number {
  const kmh = MAX_SPEED_KMH_BY_ACTIVITY[activity] ?? DEFAULT_MAX_SPEED_KMH;
  return (kmh * 1000) / 3600;
}

/** True when the implied speed between two consecutive fixes is physically plausible for the
 * activity — false for either a non-positive time gap or a speed above the activity's max, both
 * of which mean the distance between these two fixes shouldn't be trusted (treat it as noise
 * rather than adding an inflated jump). */
export function isRealisticSpeed(meters: number, dtSeconds: number, maxSpeedMps: number): boolean {
  if (dtSeconds <= 0) return false;
  return meters / dtSeconds <= maxSpeedMps;
}

/** Simple trailing moving average over the last `windowSize` values (fewer if not enough history
 * has accumulated yet) — used to smooth GPS altitude noise before it feeds into elevation gain,
 * since even a stationary device's altitude fix wobbles by a meter or more between reads. Returns
 * 0 for an empty input so a caller can't divide by zero. */
export function movingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}
