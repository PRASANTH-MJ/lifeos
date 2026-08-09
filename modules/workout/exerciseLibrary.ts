import exercisesData from './data/exercises.json';

export type LibraryExercise = {
  key: string;
  name: string;
  category: string;
  muscles: string[];
  musclesSecondary: string[];
  equipment: string[];
  description: string;
  imageUrl: string | null;
};

export const EXERCISE_LIBRARY: LibraryExercise[] = exercisesData as LibraryExercise[];

export const EXERCISE_CATEGORIES: string[] = Array.from(new Set(EXERCISE_LIBRARY.map((e) => e.category))).sort();

export const EXERCISE_EQUIPMENT: string[] = Array.from(new Set(EXERCISE_LIBRARY.flatMap((e) => e.equipment))).sort();

export const EXERCISE_MUSCLES: string[] = Array.from(
  new Set(EXERCISE_LIBRARY.flatMap((e) => [...e.muscles, ...e.musclesSecondary]))
).sort();

export function findLibraryExercise(key: string): LibraryExercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.key === key);
}

export function searchExercises(
  query: string,
  filters: { category?: string | null; equipment?: string | null; muscle?: string | null } = {}
): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return EXERCISE_LIBRARY.filter((exercise) => {
    if (filters.category && exercise.category !== filters.category) return false;
    if (filters.equipment && !exercise.equipment.includes(filters.equipment)) return false;
    if (filters.muscle && !exercise.muscles.includes(filters.muscle) && !exercise.musclesSecondary.includes(filters.muscle)) return false;
    if (q && !exercise.name.toLowerCase().includes(q)) return false;
    return true;
  });
}
