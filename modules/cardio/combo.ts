import { CARDIO_ACTIVITY_LABELS } from './types';
import type { CardioLog } from './types';

/** Every log sharing `comboGroupId` with `log` — including `log` itself, sorted the same way
 * cardio_logs is fetched (createdAt ascending, so a brick's legs read in the order they were
 * actually done). `allLogs` should be the whole cross-activity list (useCardioLogs' `logs`), not
 * one activity's filtered slice, since a brick's legs are rarely the same activity. */
export function findComboSiblings(allLogs: CardioLog[], comboGroupId: string): CardioLog[] {
  return allLogs.filter((log) => log.comboGroupId === comboGroupId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** "Brick: 5km run + 15km bike" — falls back to duration for a leg with no distance (yoga/sports/
 * swimming can still be one leg of a brick). */
export function comboSummaryLabel(legs: CardioLog[]): string {
  const parts = legs.map((leg) => {
    const activityLabel = CARDIO_ACTIVITY_LABELS[leg.activity].toLowerCase();
    return leg.distanceKm != null ? `${leg.distanceKm}km ${activityLabel}` : `${leg.durationMinutes}min ${activityLabel}`;
  });
  return `Brick: ${parts.join(' + ')}`;
}
