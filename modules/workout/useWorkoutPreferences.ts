import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePreferences = useCallback(
    async (next: Partial<WorkoutPreferences>) => {
      const merged: WorkoutPreferences = {
        goal: 'general',
        equipment: [],
        timeMinutes: 30,
        ...preferences,
        ...next,
      };
      await db.runAsync(
        `INSERT INTO workout_preferences (id, goal, equipment, time_minutes, updated_at) VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET goal = excluded.goal, equipment = excluded.equipment,
           time_minutes = excluded.time_minutes, updated_at = excluded.updated_at`,
        [merged.goal, JSON.stringify(merged.equipment), merged.timeMinutes, new Date().toISOString()]
      );
      await refresh();
    },
    [db, preferences, refresh]
  );

  return { preferences, loading, updatePreferences };
}
