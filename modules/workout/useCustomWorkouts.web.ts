import { useCallback } from 'react';

import { useLocalTable } from '@/db/useLocalTable.web';
import { EQUIPMENT_OPTIONS, GOALS, type CustomWorkoutExercise, type Equipment, type Workout, type WorkoutGoal } from './types';

/** Mirrors custom_workouts' CHECK constraints (db/schema.ts) — SQLite would reject a
 * violating insert; IndexedDB has no such guard. */
function assertValidWorkoutShape(goal: WorkoutGoal, equipment: Equipment): void {
  if (!GOALS.includes(goal)) throw new Error(`Invalid goal "${goal}"`);
  if (!EQUIPMENT_OPTIONS.includes(equipment)) throw new Error(`Invalid equipment "${equipment}"`);
}

type CustomWorkoutRow = {
  id: number;
  title: string;
  goal: WorkoutGoal;
  equipment: Equipment;
  minutes: number;
  exercises: string;
  created_at: string;
};

/** Mirrors useCustomWorkouts.ts's parseExercises — reads both the legacy plain `string[]` shape
 * and the current `CustomWorkoutExercise[]` one. */
function parseExercises(json: string): CustomWorkoutExercise[] {
  const parsed = JSON.parse(json) as (string | CustomWorkoutExercise)[];
  return parsed.map((entry) => (typeof entry === 'string' ? { text: entry, supersetGroup: null } : entry));
}

function toWorkout(row: CustomWorkoutRow): Workout {
  const exercises = parseExercises(row.exercises);
  return {
    key: `custom-${row.id}`,
    title: row.title,
    goal: row.goal,
    equipment: row.equipment,
    minutes: row.minutes,
    exercises: exercises.map((e) => e.text),
    exerciseGroups: exercises.map((e) => e.supersetGroup),
  };
}

/** Web build of useCustomWorkouts.ts — same exported shape. `ORDER BY created_at DESC` becomes
 * a plain JS comparator; useLocalTable's useLiveQuery keeps `workouts` in sync across every tab
 * automatically, so no manual refresh() is needed after addWorkout/removeWorkout/
 * addExerciseToWorkout (kept as a no-op passthrough only so existing callers don't need
 * changing). */
export function useCustomWorkouts() {
  const table = useLocalTable<CustomWorkoutRow>('custom_workouts', {
    sort: (a, b) => b.created_at.localeCompare(a.created_at),
  });

  const addWorkout = useCallback(
    (values: { title: string; goal: WorkoutGoal; equipment: Equipment; minutes: number; exercises: CustomWorkoutExercise[] }) => {
      assertValidWorkoutShape(values.goal, values.equipment);
      return table.insert({
        title: values.title,
        goal: values.goal,
        equipment: values.equipment,
        minutes: values.minutes,
        exercises: JSON.stringify(values.exercises),
        created_at: new Date().toISOString(),
      } as Partial<CustomWorkoutRow>);
    },
    [table]
  );

  const removeWorkout = useCallback(
    (key: string) => table.remove(Number(key.replace('custom-', ''))),
    [table]
  );

  const addExerciseToWorkout = useCallback(
    (key: string, exerciseLine: string) => {
      const id = Number(key.replace('custom-', ''));
      const row = table.rows.find((r) => r.id === id);
      if (!row) return Promise.resolve();
      const exercises: CustomWorkoutExercise[] = [...parseExercises(row.exercises), { text: exerciseLine, supersetGroup: null }];
      return table.update(id, { exercises: JSON.stringify(exercises) } as Partial<CustomWorkoutRow>);
    },
    [table]
  );

  return {
    workouts: table.rows.map(toWorkout),
    loading: table.loading,
    addWorkout,
    removeWorkout,
    addExerciseToWorkout,
    refresh: table.refresh,
  };
}
