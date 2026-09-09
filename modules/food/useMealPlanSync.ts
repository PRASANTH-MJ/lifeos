import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { firestore } from '@/firebase/config';

type MealPlanDoc = {
  key: string;
  title: string;
  description: string;
  goal: string;
  budgetTier: string;
  diet: string;
  dailyCaloriesTarget: number | null;
  days: Array<{
    key: string;
    title: string;
    items: Array<{ meal: string; dishName: string; calories: number; proteinG: number; carbsG: number; fatG: number }>;
  }>;
};

async function replaceMealPlan(db: SQLiteDatabase, doc: MealPlanDoc, now: string) {
  await db.runAsync(
    `INSERT INTO meal_plans (key, title, description, goal, budget_tier, diet, daily_calories_target, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'firestore', ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       title = excluded.title, description = excluded.description, goal = excluded.goal,
       budget_tier = excluded.budget_tier, diet = excluded.diet, daily_calories_target = excluded.daily_calories_target,
       source = excluded.source, updated_at = excluded.updated_at`,
    [doc.key, doc.title, doc.description ?? '', doc.goal ?? 'general', doc.budgetTier ?? 'budget', doc.diet ?? 'veg', doc.dailyCaloriesTarget ?? null, now, now]
  );
  await db.runAsync('DELETE FROM meal_plan_days WHERE plan_key = ?', [doc.key]);
  await db.runAsync('DELETE FROM meal_plan_items WHERE plan_key = ?', [doc.key]);
  for (const [dayIndex, day] of (doc.days ?? []).entries()) {
    await db.runAsync('INSERT INTO meal_plan_days (plan_key, day_key, title, sort_order) VALUES (?, ?, ?, ?)', [
      doc.key,
      day.key,
      day.title,
      dayIndex,
    ]);
    for (const [itemIndex, item] of (day.items ?? []).entries()) {
      await db.runAsync(
        `INSERT INTO meal_plan_items (plan_key, day_key, meal, dish_name, calories, protein_g, carbs_g, fat_g, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.key, day.key, item.meal, item.dishName, item.calories, item.proteinG, item.carbsG, item.fatG, itemIndex]
      );
    }
  }
}

/** Mirrors modules/workout/useExerciseCatalogSync.ts's shape for the Food module's meal-plan
 * catalog — pulls the shared, read-only `mealPlans` Firestore collection down into local SQLite.
 * Silent-safe offline: a failed sync leaves whatever was already seeded/previously synced intact. */
export function useMealPlanSync() {
  const db = useSQLiteContext();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const snapshot = await getDocs(collection(firestore, 'mealPlans'));
      for (const docSnap of snapshot.docs) {
        await replaceMealPlan(db, docSnap.data() as MealPlanDoc, now);
      }
    } catch {
      setError('Could not refresh meal plans — showing what was last saved on this device.');
    } finally {
      setSyncing(false);
    }
  }, [db]);

  useEffect(() => {
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { syncing, error, syncNow };
}
