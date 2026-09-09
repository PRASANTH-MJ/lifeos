/** "M:SS" elapsed-time readout for an in-progress live session's stopwatch and rest timer —
 * deliberately simpler than cardio's formatElapsed (no hour segment: a live workout session is
 * never expected to run that long). */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Total weight lifted across every completed set of a live session (weight × reps, summed) —
 * unlogged fields (blank reps/weight) count as 0 rather than throwing, since a set can be marked
 * done before both fields are filled in. */
export function computeSessionVolume(exercises: { sets: { reps: string; weightKg: string; done: boolean }[] }[]): number {
  return exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.done).reduce((setSum, s) => setSum + (Number(s.weightKg) || 0) * (Number(s.reps) || 0), 0),
    0
  );
}
