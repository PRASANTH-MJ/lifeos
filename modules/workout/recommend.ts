import type { Equipment, Workout, WorkoutPreferences } from './types';

function meetsEquipment(workout: Workout, owned: Equipment[]): boolean {
  if (workout.equipment === 'none') return true;
  if (workout.equipment === 'dumbbells') return owned.includes('dumbbells') || owned.includes('full-gym');
  return owned.includes('full-gym');
}

/**
 * Filters by equipment first (a hard constraint — you can't do a barbell
 * workout without a barbell), then time, relaxing time if nothing fits;
 * prefers an exact goal match but falls back to whatever's left. `seed`
 * (e.g. day-of-year) picks deterministically among the final candidates so
 * the recommendation is stable for a given day.
 */
export function pickRecommendedWorkout(workouts: Workout[], preferences: WorkoutPreferences, seed: number): Workout | null {
  const equipmentOk = workouts.filter((workout) => meetsEquipment(workout, preferences.equipment));
  if (equipmentOk.length === 0) return workouts[0] ?? null;

  const withinTime = equipmentOk.filter((workout) => workout.minutes <= preferences.timeMinutes);
  const timePool = withinTime.length > 0 ? withinTime : [...equipmentOk].sort((a, b) => a.minutes - b.minutes).slice(0, 1);

  const goalMatches = timePool.filter((workout) => workout.goal === preferences.goal);
  const finalPool = goalMatches.length > 0 ? goalMatches : timePool;

  return finalPool[seed % finalPool.length] ?? null;
}
