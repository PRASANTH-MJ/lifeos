import { formatElapsed } from './milestones';
import { haversineKm, type RoutePoint } from './locationTracking';

export type CardioSplit = {
  km: number;
  seconds: number;
  paceLabel: string;
};

const SPLIT_DISTANCE_KM = 1;

/** Whether splits can be computed for this route at all — every point needs a `timestamp` (see
 * RoutePoint in locationTracking.ts), which only exists on points recorded after that field was
 * added. A log saved before then simply can't have per-km pace reconstructed retroactively, so
 * callers should skip the splits section entirely rather than show a wrong/estimated one. */
export function hasSplitTimestamps(points: RoutePoint[]): boolean {
  return points.length >= 2 && points.every((p) => p.timestamp != null);
}

/**
 * Per-kilometer splits computed by walking the recorded route in order and linearly interpolating
 * the moment each whole-km boundary was crossed between the two points that bracket it. Only
 * whole splits are returned — a trailing partial km (e.g. the last 400m of a 3.4km run) isn't
 * included, matching the simple "Km 1, Km 2, ..." list this backs rather than a fractional final
 * row. Returns `[]` if `hasSplitTimestamps` would be false — callers that already gate on that can
 * treat an empty result as "nothing to show" either way.
 */
export function computeSplits(points: RoutePoint[]): CardioSplit[] {
  if (!hasSplitTimestamps(points)) return [];

  const splits: CardioSplit[] = [];
  let cumulativeKm = 0;
  let nextBoundaryKm = SPLIT_DISTANCE_KM;
  let splitStartTimestamp = points[0].timestamp as number;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const segmentKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    if (segmentKm <= 0) continue;
    const segmentStartKm = cumulativeKm;
    cumulativeKm += segmentKm;

    while (cumulativeKm >= nextBoundaryKm) {
      const fraction = (nextBoundaryKm - segmentStartKm) / segmentKm;
      const boundaryTimestamp = (prev.timestamp as number) + fraction * ((curr.timestamp as number) - (prev.timestamp as number));
      const seconds = Math.round((boundaryTimestamp - splitStartTimestamp) / 1000);
      splits.push({ km: splits.length + 1, seconds, paceLabel: `${formatElapsed(seconds)}/km` });
      splitStartTimestamp = boundaryTimestamp;
      nextBoundaryKm += SPLIT_DISTANCE_KM;
    }
  }

  return splits;
}
