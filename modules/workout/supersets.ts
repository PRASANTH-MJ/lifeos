/** Groups a workout's flat `exercises`/`exerciseGroups` arrays into display runs — a run of 2+
 * consecutive exercises sharing the same non-null group number becomes one `superset` run (shown
 * bracketed together, e.g. one shared-border Card); everything else is its own standalone run,
 * same as before superset grouping existed. A "group" of exactly 1 (shouldn't normally happen —
 * see new.tsx's toSupersetExercises, which only ever assigns a group to 2+ linked rows — but
 * cheap to guard here too) reads as standalone rather than a superset of one. */
export type ExerciseRun = { superset: boolean; items: { text: string; index: number }[] };

export function groupExerciseRuns(exercises: string[], exerciseGroups?: (number | null)[]): ExerciseRun[] {
  const runs: ExerciseRun[] = [];
  let i = 0;
  while (i < exercises.length) {
    const group = exerciseGroups?.[i] ?? null;
    if (group == null) {
      runs.push({ superset: false, items: [{ text: exercises[i], index: i }] });
      i += 1;
      continue;
    }
    const items: { text: string; index: number }[] = [];
    while (i < exercises.length && exerciseGroups?.[i] === group) {
      items.push({ text: exercises[i], index: i });
      i += 1;
    }
    runs.push(items.length > 1 ? { superset: true, items } : { superset: false, items });
  }
  return runs;
}
