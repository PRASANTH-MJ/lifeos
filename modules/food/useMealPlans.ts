import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

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
type DayRow = { plan_key: string; day_key: string; title: string };
type ItemRow = {
  plan_key: string;
  day_key: string;
  meal: MealPlanItem['meal'];
  dish_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/** Same read pattern as modules/workout/usePrograms.ts — 3 flat queries, grouped in memory,
 * since a meal-plan catalog is always small enough that this beats a real join. */
export function useMealPlans() {
  const db = useSQLiteContext();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [planRows, dayRows, itemRows] = await Promise.all([
      db.getAllAsync<PlanRow>(
        'SELECT key, title, description, goal, budget_tier, diet, daily_calories_target FROM meal_plans ORDER BY title ASC'
      ),
      db.getAllAsync<DayRow>('SELECT plan_key, day_key, title FROM meal_plan_days ORDER BY sort_order ASC'),
      db.getAllAsync<ItemRow>(
        'SELECT plan_key, day_key, meal, dish_name, calories, protein_g, carbs_g, fat_g FROM meal_plan_items ORDER BY sort_order ASC'
      ),
    ]);

    setPlans(
      planRows.map((plan) => ({
        key: plan.key,
        title: plan.title,
        description: plan.description,
        goal: plan.goal,
        budgetTier: plan.budget_tier,
        diet: plan.diet,
        dailyCaloriesTarget: plan.daily_calories_target,
        days: dayRows
          .filter((day) => day.plan_key === plan.key)
          .map((day) => ({
            key: day.day_key,
            title: day.title,
            items: itemRows
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
      }))
    );
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { plans, loading, refresh };
}

export function findMealPlan(plans: MealPlan[], key: string): MealPlan | undefined {
  return plans.find((plan) => plan.key === key);
}
