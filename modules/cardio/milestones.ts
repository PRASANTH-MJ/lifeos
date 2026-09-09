export type ActivityMilestoneTier = { count: number; label: string };

/** "MM:SS", or "H:MM:SS" once an hour in — shared by record.tsx's live timer and save.tsx's
 * post-run stat reveal so the two screens never format the same number two different ways. */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "MM:SS/km" pace via formatElapsed, or '—' once distance or time is zero — shared by
 * save.tsx's stat reveal and its post-save share-card stat row, extracted so both compute pace
 * the same way instead of inlining the same division twice. */
export function formatPace(distanceKm: number, elapsedSeconds: number): string {
  if (distanceKm <= 0 || elapsedSeconds <= 0) return '—';
  return `${formatElapsed(Math.round(elapsedSeconds / distanceKm))}/km`;
}

/** Average speed in km/h to one decimal place, under the same zero-guard as formatPace. */
export function formatSpeedKmh(distanceKm: number, elapsedSeconds: number): string {
  if (distanceKm <= 0 || elapsedSeconds <= 0) return '—';
  return (distanceKm / (elapsedSeconds / 3600)).toFixed(1);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const MILESTONE_COUNTS = [
  1, 3, 5, 10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000,
];

/** Total-activity-count milestones, counted across every cardio activity combined (not
 * per-sport) — matches Strava's own generic "Nth Activity" milestones rather than a separate
 * trophy shelf per sport. */
export const ACTIVITY_MILESTONE_TIERS: ActivityMilestoneTier[] = MILESTONE_COUNTS.map((count) => ({
  count,
  label: `${ordinal(count)} Activity`,
}));
