import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow } from '@/modules/sync';
import { DEFAULT_CARDIO_PREFS, type CardioActivity, type CardioActivityPrefs, type CardioFrequency } from './types';

type PrefRow = { id: number; activity: string; is_recurring: number; frequency: string; target_days: string };

/** Recurring-schedule prefs for the 5 fixed cardio activities — a row only exists once a user has
 * actually turned recurring on for that activity (a fresh install has zero rows, same convention
 * as module_reminders); missing means DEFAULT_CARDIO_PREFS (not recurring). */
export function useCardioActivityPrefs() {
  const db = useSQLiteContext();
  const [prefsByActivity, setPrefsByActivity] = useState<Record<string, CardioActivityPrefs & { id: number }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<PrefRow>('SELECT * FROM cardio_activities');
    const next: Record<string, CardioActivityPrefs & { id: number }> = {};
    for (const row of rows) {
      next[row.activity] = {
        id: row.id,
        isRecurring: row.is_recurring === 1,
        frequency: row.frequency as CardioFrequency,
        targetDays: JSON.parse(row.target_days || '[]'),
      };
    }
    setPrefsByActivity(next);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const getPrefs = useCallback((activity: CardioActivity): CardioActivityPrefs => prefsByActivity[activity] ?? DEFAULT_CARDIO_PREFS, [prefsByActivity]);

  const savePrefs = useCallback(
    async (activity: CardioActivity, next: CardioActivityPrefs) => {
      const now = new Date().toISOString();
      const existing = prefsByActivity[activity];
      if (existing) {
        await db.runAsync('UPDATE cardio_activities SET is_recurring = ?, frequency = ?, target_days = ?, updated_at = ? WHERE id = ?', [
          next.isRecurring ? 1 : 0,
          next.frequency,
          JSON.stringify(next.targetDays),
          now,
          existing.id,
        ]);
        await pushLocalRow(db, 'cardio_activities', existing.id);
      } else {
        // sync_id must be set on insert — pushLocalRow silently no-ops on a null sync_id, so an
        // activity's recurring schedule would otherwise never sync cross-device.
        const result = await db.runAsync(
          'INSERT INTO cardio_activities (activity, is_recurring, frequency, target_days, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?)',
          [activity, next.isRecurring ? 1 : 0, next.frequency, JSON.stringify(next.targetDays), now, Crypto.randomUUID()]
        );
        await pushLocalRow(db, 'cardio_activities', result.lastInsertRowId);
      }
      await refresh();
    },
    [db, prefsByActivity, refresh]
  );

  return { getPrefs, savePrefs, loading };
}
