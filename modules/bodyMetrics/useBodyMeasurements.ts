import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

export type BodyMeasurement = { id: number; date: string; weight_kg: number; created_at: string };

/** A dated weight trend, distinct from user_details.weight_kg (a single onboarding snapshot, not
 * a series) — one row per calendar day, upserted by date so logging again the same day corrects
 * today's entry instead of creating a duplicate point on the trend chart. */
export function useBodyMeasurements() {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<BodyMeasurement>('SELECT * FROM body_measurements ORDER BY date ASC');
    setEntries(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addEntry = useCallback(
    async (date: string, weightKg: number) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO body_measurements (date, weight_kg, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`,
        [date, weightKg, now, now, Crypto.randomUUID()]
      );
      const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM body_measurements WHERE date = ?', [date]);
      if (row) await pushLocalRow(db, 'body_measurements', row.id);
      await refresh();
    },
    [db, refresh]
  );

  const removeEntry = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'body_measurements', id);
      await db.runAsync('DELETE FROM body_measurements WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  return { entries, loading, addEntry, removeEntry, refresh };
}
