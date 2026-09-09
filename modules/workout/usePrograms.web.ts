import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

export type ProgramExercise = { exerciseKey: string; sets: number; reps: number; note: string | null };
export type ProgramDay = { key: string; title: string; exercises: ProgramExercise[] };
export type Program = {
  key: string;
  title: string;
  description: string;
  goal: string;
  equipment: string;
  weeks: number;
  days: ProgramDay[];
};

type ProgramRow = { key: string; title: string; description: string; goal: string; equipment: string; weeks: number };
type DayRow = { program_key: string; day_key: string; title: string; sort_order: number };
type ExerciseRow = {
  program_key: string;
  day_key: string;
  exercise_key: string;
  sets: number;
  reps: number;
  note: string | null;
  sort_order: number;
};

/** Reads the full programs → days → exercises tree from IndexedDB in 3 table reads (not N+1 —
 * fetches every day/exercise row up front and groups them in memory), since a program list is
 * always small enough that this is simpler than a real join. Reactive via useLiveQuery: a write
 * to any of the three tables in any tab re-runs this and updates every open tab's view. */
export function usePrograms() {
  const programs = useLiveQuery(async () => {
    const [programRows, dayRows, exerciseRows] = await Promise.all([
      webDb.table<ProgramRow>('programs').toArray(),
      webDb.table<DayRow>('program_days').toArray(),
      webDb.table<ExerciseRow>('program_exercises').toArray(),
    ]);

    const sortedPrograms = [...programRows].sort((a, b) => a.title.localeCompare(b.title));
    const sortedDays = [...dayRows].sort((a, b) => a.sort_order - b.sort_order);
    const sortedExercises = [...exerciseRows].sort((a, b) => a.sort_order - b.sort_order);

    return sortedPrograms.map((program) => ({
      ...program,
      days: sortedDays
        .filter((day) => day.program_key === program.key)
        .map((day) => ({
          key: day.day_key,
          title: day.title,
          exercises: sortedExercises
            .filter((exercise) => exercise.program_key === program.key && exercise.day_key === day.day_key)
            .map((exercise) => ({ exerciseKey: exercise.exercise_key, sets: exercise.sets, reps: exercise.reps, note: exercise.note })),
        })),
    }));
  }, []);

  const loading = programs === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  return { programs: programs ?? [], loading, refresh };
}

export function findProgram(programs: Program[], key: string): Program | undefined {
  return programs.find((program) => program.key === key);
}

/** A taste of the multi-week library stays free (one per major goal — general, weight-loss,
 * strength) so free users can see the format before hitting the paywall; the rest (mostly
 * muscle-building splits, the deepest commitment) are premium-only. The two standalone
 * warm-up/cool-down routines are generic bookends for any workout, not "premium content" — they
 * stay free regardless. */
const FREE_PROGRAM_KEYS = new Set([
  'beginner-bodyweight-3wk',
  'fat-loss-circuit-4wk',
  'full-body-strength-4wk',
  'warm-up-routine',
  'cool-down-stretching',
]);

export function isProgramFree(key: string): boolean {
  return FREE_PROGRAM_KEYS.has(key);
}
