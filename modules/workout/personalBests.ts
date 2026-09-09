/** Heaviest single-set weight logged for one exercise, in kg — null if it's never been logged
 * with a weight before. `logs` should already be scoped to the one exercise_key (matches how
 * useExerciseLogs/insertExerciseLog are both already per-exercise). */
export function bestWeightKg(logs: { weight_kg: number | null }[]): number | null {
  return logs.reduce<number | null>((best, log) => (log.weight_kg != null && (best == null || log.weight_kg > best) ? log.weight_kg : best), null);
}

/** Whether a just-logged set's weight beats the prior best — call with the *existing* logs for
 * that exercise (pre-insert) so the new set isn't compared against itself. */
export function isNewWeightPr(priorLogs: { weight_kg: number | null }[], candidateWeightKg: number | null): boolean {
  if (candidateWeightKg == null || candidateWeightKg <= 0) return false;
  const prior = bestWeightKg(priorLogs);
  return prior == null || candidateWeightKg > prior;
}
