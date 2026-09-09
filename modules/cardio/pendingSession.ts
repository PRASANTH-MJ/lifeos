import type { CardioActivity } from './types';
import type { RoutePoint } from './locationTracking';

export type PendingCardioSession = {
  activity: CardioActivity;
  distanceKm: number;
  elapsedSeconds: number;
  points: RoutePoint[];
  elevationGainM: number;
  /** Set when this leg is part of a "brick" session started via "Add another leg to this
   * session?" on a previous leg's save screen — carried forward into THIS leg's own save so it
   * gets stamped with the same id, linking every leg together (see modules/cardio/combo.ts). Null
   * for a standalone session. */
  comboGroupId: string | null;
};

/** Hands a just-finished GPS session from record.tsx to save.tsx without going through a router
 * param — a session's route can be thousands of {lat,lng} points, far too large to serialize into
 * a URL param safely. Module-level state is fine here: exactly one recording can be in progress at
 * a time, and save.tsx is always pushed immediately after record.tsx sets this, so there's no
 * multi-session or stale-read risk to guard against. */
let pending: PendingCardioSession | null = null;

export function setPendingSession(session: PendingCardioSession): void {
  pending = session;
}

export function getPendingSession(): PendingCardioSession | null {
  return pending;
}

export function clearPendingSession(): void {
  pending = null;
}
