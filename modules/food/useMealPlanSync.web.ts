import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { firestore } from '@/firebase/config';
import { webDb } from '@/db/webDb';
import { MEALS } from './types';

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

async function replaceMealPlan(doc: MealPlanDoc, now: string) {
  await webDb.transaction('rw', [webDb.meal_plans, webDb.meal_plan_days, webDb.meal_plan_items], async () => {
    // Upsert into meal_plans keyed by the unique `key` column (mirrors the native
    // `INSERT ... ON CONFLICT(key) DO UPDATE SET ...`).
    const existingPlan = await webDb.meal_plans.where('key').equals(doc.key).first();
    const planFields = {
      key: doc.key,
      title: doc.title,
      description: doc.description ?? '',
      goal: doc.goal ?? 'general',
      budget_tier: doc.budgetTier ?? 'budget',
      diet: doc.diet ?? 'veg',
      daily_calories_target: doc.dailyCaloriesTarget ?? null,
      source: 'firestore',
      updated_at: now,
    };
    if (existingPlan) {
      await webDb.meal_plans.update((existingPlan as { id: number }).id, planFields as never);
    } else {
      await webDb.meal_plans.add({ ...planFields, created_at: now } as never);
    }

    // DELETE FROM meal_plan_days/meal_plan_items WHERE plan_key = ?
    await webDb.meal_plan_days.where('plan_key').equals(doc.key).delete();
    // meal_plan_items has no `plan_key` index of its own (only the compound
    // [plan_key+day_key] index), so filter+bulkDelete instead of `.where('plan_key')`.
    const itemRows = await webDb.meal_plan_items.toArray();
    const staleItemIds = itemRows
      .filter((r) => (r as { plan_key: string }).plan_key === doc.key)
      .map((r) => (r as { id: number }).id);
    await webDb.meal_plan_items.bulkDelete(staleItemIds);

    for (const [dayIndex, day] of (doc.days ?? []).entries()) {
      await webDb.meal_plan_days.add({
        plan_key: doc.key,
        day_key: day.key,
        title: day.title,
        sort_order: dayIndex,
      } as never);

      for (const [itemIndex, item] of (day.items ?? []).entries()) {
        // Mirrors meal_plan_items' `CHECK (meal IN (...))` (db/schema.ts) — native SQL would
        // reject a malformed Firestore doc's insert and surface the caught error while leaving
        // prior local data intact; IndexedDB has no such guard, so it must be explicit here too.
        if (!MEALS.includes(item.meal as never)) throw new Error(`Invalid meal "${item.meal}" in meal plan "${doc.key}"`);
        await webDb.meal_plan_items.add({
          plan_key: doc.key,
          day_key: day.key,
          meal: item.meal,
          dish_name: item.dishName,
          calories: item.calories,
          protein_g: item.proteinG,
          carbs_g: item.carbsG,
          fat_g: item.fatG,
          sort_order: itemIndex,
        } as never);
      }
    }
  });
}

/** Mirrors modules/workout/useExerciseCatalogSync.web.ts's shape for the Food module's meal-plan
 * catalog — pulls the shared, read-only `mealPlans` Firestore collection down into local
 * IndexedDB (via Dexie). Silent-safe offline: a failed sync leaves whatever was already
 * seeded/previously synced intact. */
export function useMealPlanSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const snapshot = await getDocs(collection(firestore, 'mealPlans'));
      for (const docSnap of snapshot.docs) {
        await replaceMealPlan(docSnap.data() as MealPlanDoc, now);
      }
    } catch {
      setError('Could not refresh meal plans — showing what was last saved on this device.');
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { syncing, error, syncNow };
}
