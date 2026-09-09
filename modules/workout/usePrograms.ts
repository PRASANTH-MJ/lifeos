import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

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
type DayRow = { program_key: string; day_key: string; title: string };
type ExerciseRow = { program_key: string; day_key: string; exercise_key: string; sets: number; reps: number; note: string | null };

/** Reads the full programs → days → exercises tree from local SQLite in 3 queries (not N+1 —
 * fetches every day/exercise row up front and groups them in memory), since a program list is
 * always small enough that this is simpler than a real join. */
export function usePrograms() {
  const db = useSQLiteContext();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [programRows, dayRows, exerciseRows] = await Promise.all([
      db.getAllAsync<ProgramRow>('SELECT key, title, description, goal, equipment, weeks FROM programs ORDER BY title ASC'),
      db.getAllAsync<DayRow>('SELECT program_key, day_key, title FROM program_days ORDER BY sort_order ASC'),
      db.getAllAsync<ExerciseRow>('SELECT program_key, day_key, exercise_key, sets, reps, note FROM program_exercises ORDER BY sort_order ASC'),
    ]);

    setPrograms(
      programRows.map((program) => ({
        ...program,
        days: dayRows
          .filter((day) => day.program_key === program.key)
          .map((day) => ({
            key: day.day_key,
            title: day.title,
            exercises: exerciseRows
              .filter((exercise) => exercise.program_key === program.key && exercise.day_key === day.day_key)
              .map((exercise) => ({ exerciseKey: exercise.exercise_key, sets: exercise.sets, reps: exercise.reps, note: exercise.note })),
          })),
      }))
    );
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { programs, loading, refresh };
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
