import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow } from '@/modules/sync';
import type { Equipment, WorkoutGoal, WorkoutPreferences } from './types';

export function useWorkoutPreferences() {
  const db = useSQLiteContext();
  const [preferences, setPreferences] = useState<WorkoutPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<{ goal: string; equipment: string; time_minutes: number }>(
      'SELECT goal, equipment, time_minutes FROM workout_preferences WHERE id = 1'
    );
    if (row) {
      setPreferences({
        goal: row.goal as WorkoutGoal,
        equipment: JSON.parse(row.equipment) as Equipment[],
        timeMinutes: row.time_minutes,
      });
    }
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const updatePreferences = useCallback(
    async (next: Partial<WorkoutPreferences>) => {
      const merged: WorkoutPreferences = {
        goal: 'general',
        equipment: [],
        timeMinutes: 30,
        ...preferences,
        ...next,
      };
      // sync_id defaults to the fixed 'singleton' literal (matching the migration that backfilled
      // it for pre-existing rows — db/schema.ts) rather than a random UUID, since this is a
      // singleton row keyed by id=1, not a many-row table. Without this, a row created via this
      // INSERT (fresh install, or first-ever save) would have a NULL sync_id and pushLocalRow
      // would silently no-op forever — this table would never sync cross-device.
      await db.runAsync(
        `INSERT INTO workout_preferences (id, goal, equipment, time_minutes, updated_at, sync_id) VALUES (1, ?, ?, ?, ?, 'singleton')
         ON CONFLICT(id) DO UPDATE SET goal = excluded.goal, equipment = excluded.equipment,
           time_minutes = excluded.time_minutes, updated_at = excluded.updated_at,
           sync_id = COALESCE(workout_preferences.sync_id, 'singleton')`,
        [merged.goal, JSON.stringify(merged.equipment), merged.timeMinutes, new Date().toISOString()]
      );
      await pushLocalRow(db, 'workout_preferences', 1);
      await refresh();
    },
    [db, preferences, refresh]
  );

  return { preferences, loading, updatePreferences, refresh };
}
