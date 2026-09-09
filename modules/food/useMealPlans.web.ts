import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

export type MealPlanItem = {
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dishName: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};
export type MealPlanDay = { key: string; title: string; items: MealPlanItem[] };
export type MealPlan = {
  key: string;
  title: string;
  description: string;
  goal: string;
  budgetTier: string;
  diet: string;
  dailyCaloriesTarget: number | null;
  days: MealPlanDay[];
};

type PlanRow = {
  key: string;
  title: string;
  description: string;
  goal: string;
  budget_tier: string;
  diet: string;
  daily_calories_target: number | null;
};
type DayRow = { plan_key: string; day_key: string; title: string; sort_order: number };
type ItemRow = {
  plan_key: string;
  day_key: string;
  meal: MealPlanItem['meal'];
  dish_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sort_order: number;
};

/**
 * Web build of useMealPlans.ts — same exported shape. The native version does 3 flat SQL
 * queries (each pre-sorted via ORDER BY) and groups the rows in memory; here all three tables
 * are read via useLiveQuery (so any tab's write to the meal-plan catalog refreshes every open
 * tab automatically) and sorted in JS to match the exact same ORDER BY semantics:
 *   - meal_plans: ORDER BY title ASC
 *   - meal_plan_days / meal_plan_items: ORDER BY sort_order ASC
 */
export function useMealPlans() {
  const plans = useLiveQuery(async () => {
    const [planRows, dayRows, itemRows] = await Promise.all([
      webDb.meal_plans.toArray() as unknown as Promise<PlanRow[]>,
      webDb.meal_plan_days.toArray() as unknown as Promise<DayRow[]>,
      webDb.meal_plan_items.toArray() as unknown as Promise<ItemRow[]>,
    ]);

    const sortedPlans = [...planRows].sort((a, b) => a.title.localeCompare(b.title));
    const sortedDays = [...dayRows].sort((a, b) => a.sort_order - b.sort_order);
    const sortedItems = [...itemRows].sort((a, b) => a.sort_order - b.sort_order);

    return sortedPlans.map((plan) => ({
      key: plan.key,
      title: plan.title,
      description: plan.description,
      goal: plan.goal,
      budgetTier: plan.budget_tier,
      diet: plan.diet,
      dailyCaloriesTarget: plan.daily_calories_target,
      days: sortedDays
        .filter((day) => day.plan_key === plan.key)
        .map((day) => ({
          key: day.day_key,
          title: day.title,
          items: sortedItems
            .filter((item) => item.plan_key === plan.key && item.day_key === day.day_key)
            .map((item) => ({
              meal: item.meal,
              dishName: item.dish_name,
              calories: item.calories,
              proteinG: item.protein_g,
              carbsG: item.carbs_g,
              fatG: item.fat_g,
            })),
        })),
    })) as MealPlan[];
  }, []);

  const loading = plans === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { plans: plans ?? [], loading, refresh };
}

export function findMealPlan(plans: MealPlan[], key: string): MealPlan | undefined {
  return plans.find((plan) => plan.key === key);
}
