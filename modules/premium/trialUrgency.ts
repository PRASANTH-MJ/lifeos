/** How hard the trial-ending nudge should push, purely a function of days left — shared between
 * every screen that shows a trial banner (Settings, Premium) so escalation is consistent instead
 * of each screen inventing its own thresholds. 'normal' through most of the trial, 'urgent' in the
 * last 3 days (color shifts to danger, copy gets specific about the countdown), 'final' on the
 * last day (copy stops saying "days" and calls out that it ends today). */
export type TrialUrgencyLevel = 'normal' | 'urgent' | 'final';

export function trialUrgencyLevel(daysLeft: number): TrialUrgencyLevel {
  if (daysLeft <= 1) return 'final';
  if (daysLeft <= 3) return 'urgent';
  return 'normal';
}

export function trialUrgencyHeadline(daysLeft: number): string {
  const level = trialUrgencyLevel(daysLeft);
  if (level === 'final') return daysLeft <= 0 ? 'Your trial ends today' : '1 day left in your free trial';
  if (level === 'urgent') return `Only ${daysLeft} days left in your free trial`;
  return `${daysLeft} days left in your free trial`;
}
