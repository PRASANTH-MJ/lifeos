export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodLog = {
  id: number;
  description: string;
  meal: Meal;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  date: string;
  created_at: string;
};

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function mealLabel(meal: Meal): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}
