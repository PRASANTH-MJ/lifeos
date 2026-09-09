export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Ratio of "how much of a target was hit" mapped onto 0-100, capped at the target (doing 2x a
 * target isn't a "200% healthy" — it's just fully healthy on that one signal). Pulled out of
 * useLifeScore.ts so it (and clampScore) can be unit-tested without pulling in that file's
 * transitive hook imports — see __tests__/useLifeScore.test.ts. */
export function ratioScore(actual: number, target: number): number {
  if (target <= 0) return 0;
  return clampScore((actual / target) * 100);
}

/** Inverse of ratioScore: for a "less is better" signal like budget spend, where the score should
 * be highest at 0% used and only start punishing once *over* budget — reaching exactly 100% of
 * budget is still "on budget", not a failure, so it scores 70 rather than dropping to 0. Being
 * meaningfully over budget decays faster (2.5x the rate) than the gentle 0.3x-per-point taper
 * while still under, so a small overage costs more than the same-sized amount of headroom saved. */
export function budgetAdherenceScore(percentUsed: number): number {
  if (percentUsed <= 100) return clampScore(100 - percentUsed * 0.3);
  return clampScore(70 - (percentUsed - 100) * 2.5);
}
