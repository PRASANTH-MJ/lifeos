import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { Equipment, Workout, WorkoutGoal } from './types';

type CustomWorkoutRow = {
  id: number;
  title: string;
  goal: WorkoutGoal;
  equipment: Equipment;
  minutes: number;
  exercises: string;
  created_at: string;
};

function toWorkout(row: CustomWorkoutRow): Workout {
  return {
    key: `custom-${row.id}`,
    title: row.title,
    goal: row.goal,
    equipment: row.equipment,
    minutes: row.minutes,
    exercises: JSON.parse(row.exercises),
  };
}

/** User-created workouts, alongside the fixed WORKOUTS catalog — keyed `custom-<id>` so they
 * slot into the same `Workout[]` shape and can be merged with the catalog wherever it's used
 * (recommendations, browse-all, the log-past-workout picker). */
export function useCustomWorkouts() {
  const table = useLocalTable<CustomWorkoutRow>('custom_workouts', { orderBy: 'created_at DESC' });

  const addWorkout = useCallback(
    (values: { title: string; goal: WorkoutGoal; equipment: Equipment; minutes: number; exercises: string[] }) => {
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

  return {
    workouts: table.rows.map(toWorkout),
    loading: table.loading,
    addWorkout,
    removeWorkout,
    refresh: table.refresh,
  };
}
