import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { CustomWorkoutExercise, Equipment, Workout, WorkoutGoal } from './types';

type CustomWorkoutRow = {
  id: number;
  title: string;
  goal: WorkoutGoal;
  equipment: Equipment;
  minutes: number;
  exercises: string;
  created_at: string;
};

/** `exercises` was originally a plain `string[]` — this reads both that legacy shape and the
 * current `CustomWorkoutExercise[]` one, so a workout saved before superset grouping existed
 * doesn't need its own migration. */
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

/** User-created workouts, alongside the fixed WORKOUTS catalog — keyed `custom-<id>` so they
 * slot into the same `Workout[]` shape and can be merged with the catalog wherever it's used
 * (recommendations, browse-all, the log-past-workout picker). */
export function useCustomWorkouts() {
  const table = useLocalTable<CustomWorkoutRow>('custom_workouts', { orderBy: 'created_at DESC' });

  const addWorkout = useCallback(
    (values: { title: string; goal: WorkoutGoal; equipment: Equipment; minutes: number; exercises: CustomWorkoutExercise[] }) => {
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
