import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import { MEALS, type FoodLog, type Meal } from './types';

export function useFoodDay(dateKey: string) {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<FoodLog>('SELECT * FROM food_logs WHERE date = ? ORDER BY created_at ASC', [
      dateKey,
    ]);
    setLogs(rows);
    setLoading(false);
  }, [db, dateKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const createLog = useCallback(
    async (values: {
      description: string;
      meal: Meal;
      calories: number;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
    }) => {
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO food_logs (description, meal, calories, protein_g, carbs_g, fat_g, date, created_at, sync_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          values.description,
          values.meal,
          values.calories,
          values.proteinG ?? null,
          values.carbsG ?? null,
          values.fatG ?? null,
          dateKey,
          now,
          Crypto.randomUUID(),
          now,
        ]
      );
      await pushLocalRow(db, 'food_logs', result.lastInsertRowId);
      await refresh();
    },
    [db, dateKey, refresh]
  );

  const deleteLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'food_logs', id);
      await db.runAsync('DELETE FROM food_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => ({
          calories: acc.calories + log.calories,
          protein: acc.protein + (log.protein_g ?? 0),
          carbs: acc.carbs + (log.carbs_g ?? 0),
          fat: acc.fat + (log.fat_g ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [logs]
  );

  const byMeal = useMemo(() => {
    const map = Object.fromEntries(MEALS.map((meal) => [meal, [] as FoodLog[]])) as Record<Meal, FoodLog[]>;
    for (const log of logs) {
      map[log.meal].push(log);
    }
    return map;
  }, [logs]);

  return { logs, loading, totals, byMeal, createLog, deleteLog, refresh };
}
