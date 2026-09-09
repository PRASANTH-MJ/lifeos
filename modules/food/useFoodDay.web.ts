import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import { MEALS, type FoodLog, type Meal } from './types';

/** Mirrors food_logs' `CHECK (meal IN (...))` (db/schema.ts) — SQLite would reject a violating
 * insert/update; IndexedDB has no such guard, and an invalid value would later crash byMeal's
 * reducer below (which only has buckets for the four known meals). */
function assertValidMeal(meal: Meal): void {
  if (!MEALS.includes(meal)) throw new Error(`Invalid meal "${meal}"`);
}

/**
 * Web build of useFoodDay.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: a write from any tab (or the sync engine) flows into every
 * mounted useFoodDay(dateKey) instance automatically, so no manual refresh() is required.
 */
export function useFoodDay(dateKey: string) {
  const logs = useLiveQuery(async () => {
    const all = (await webDb.food_logs.toArray()) as FoodLog[];
    return all
      .filter((row) => row.date === dateKey)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }, [dateKey]);

  const loading = logs === undefined;
  const resolvedLogs = logs ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const createLog = useCallback(
    async (values: {
      description: string;
      meal: Meal;
      calories: number;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
    }) => {
      assertValidMeal(values.meal);
      const now = new Date().toISOString();
      const id = await webDb.food_logs.add({
        description: values.description,
        meal: values.meal,
        calories: values.calories,
        protein_g: values.proteinG ?? null,
        carbs_g: values.carbsG ?? null,
        fat_g: values.fatG ?? null,
        date: dateKey,
        created_at: now,
        sync_id: Crypto.randomUUID(),
        updated_at: now,
      } as never);
      await pushLocalRow('food_logs', id as number);
    },
    [dateKey]
  );

  const updateLog = useCallback(
    async (
      id: number,
      values: { description: string; meal: Meal; calories: number; proteinG?: number | null; carbsG?: number | null; fatG?: number | null }
    ) => {
      assertValidMeal(values.meal);
      await webDb.food_logs.update(id, {
        description: values.description,
        meal: values.meal,
        calories: values.calories,
        protein_g: values.proteinG ?? null,
        carbs_g: values.carbsG ?? null,
        fat_g: values.fatG ?? null,
        updated_at: new Date().toISOString(),
      } as never);
      await pushLocalRow('food_logs', id);
    },
    []
  );

  const deleteLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('food_logs', id);
    await webDb.food_logs.delete(id);
  }, []);

  const totals = useMemo(
    () =>
      resolvedLogs.reduce(
        (acc, log) => ({
          calories: acc.calories + log.calories,
          protein: acc.protein + (log.protein_g ?? 0),
          carbs: acc.carbs + (log.carbs_g ?? 0),
          fat: acc.fat + (log.fat_g ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [resolvedLogs]
  );

  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map((meal) => [meal, [] as FoodLog[]])) as Record<Meal, FoodLog[]>;
    for (const log of resolvedLogs) {
      map[log.meal].push(log);
    }
    return map;
  }, [resolvedLogs]);

  return { logs: resolvedLogs, loading, totals, byMeal, createLog, updateLog, deleteLog, refresh };
}
