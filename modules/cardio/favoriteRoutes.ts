import { haversineKm } from './locationTracking';
import type { CardioActivity, CardioLog } from './types';

export type CardioFavoriteRoute = {
  id: number;
  activity: CardioActivity;
  label: string;
  startLat: number;
  startLng: number;
  distanceKm: number;
};

/** "Same route" is deliberately a coarse heuristic, not point-for-point route matching: the start
 * point falls within this radius AND the total distance is within the tolerance below. Good
 * enough to recognize "this is my usual loop" without the complexity of comparing every point. */
const ROUTE_START_MATCH_METERS = 100;
const ROUTE_DISTANCE_TOLERANCE_RATIO = 0.15;

function startDistanceMeters(favorite: Pick<CardioFavoriteRoute, 'startLat' | 'startLng'>, point: { lat: number; lng: number }): number {
  return haversineKm(favorite.startLat, favorite.startLng, point.lat, point.lng) * 1000;
}

/** Just the start-point half of the heuristic — used while a session is still recording, before
 * a final distance is known (see record.tsx's "near a favorite route" banner). */
export function findNearbyFavoriteRouteStart(
  favorites: CardioFavoriteRoute[],
  activity: CardioActivity,
  point: { lat: number; lng: number }
): CardioFavoriteRoute | null {
  const candidates = favorites.filter((f) => f.activity === activity && startDistanceMeters(f, point) <= ROUTE_START_MATCH_METERS);
  return candidates[0] ?? null;
}

/** The full heuristic (start point + similar total distance) — used once a session has finished
 * and its actual distance is known (see save.tsx's "vs your best on this route"). */
export function findMatchingFavoriteRoute(
  favorites: CardioFavoriteRoute[],
  activity: CardioActivity,
  startPoint: { lat: number; lng: number },
  distanceKm: number
): CardioFavoriteRoute | null {
  const candidates = favorites.filter((f) => {
    if (f.activity !== activity) return false;
    if (startDistanceMeters(f, startPoint) > ROUTE_START_MATCH_METERS) return false;
    return Math.abs(f.distanceKm - distanceKm) <= f.distanceKm * ROUTE_DISTANCE_TOLERANCE_RATIO;
  });
  return candidates[0] ?? null;
}

/** Fastest duration (minutes) among logged sessions that match this favorite's route heuristic —
 * computed live from cardio_logs rather than cached on the favorite row, so it's never stale.
 * `excludeLogId` leaves out the session currently being compared against its own history. */
export function bestTimeForFavoriteRoute(favorite: CardioFavoriteRoute, logs: CardioLog[], excludeLogId?: number): number | null {
  const matches = logs.filter((log) => {
    if (log.id === excludeLogId) return false;
    if (log.activity !== favorite.activity) return false;
    if (!log.routePoints || log.routePoints.length === 0 || log.distanceKm == null) return false;
    const start = log.routePoints[0];
    if (startDistanceMeters(favorite, start) > ROUTE_START_MATCH_METERS) return false;
    return Math.abs(favorite.distanceKm - log.distanceKm) <= favorite.distanceKm * ROUTE_DISTANCE_TOLERANCE_RATIO;
  });
  if (matches.length === 0) return null;
  return Math.min(...matches.map((log) => log.durationMinutes));
}
