import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { Equipment, WorkoutGoal, WorkoutPreferences } from './types';

type PreferencesRow = { id: number; goal: string; equipment: string; time_minutes: number };

function toPreferences(row: PreferencesRow | undefined | null): WorkoutPreferences | null {
  if (!row) return null;
  return {
    goal: row.goal as WorkoutGoal,
    equipment: JSON.parse(row.equipment) as Equipment[],
    timeMinutes: row.time_minutes,
  };
}

/**
 * Web build of useWorkoutPreferences.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a write from any tab (or the sync
 * engine) flows into every mounted instance automatically.
 */
export function useWorkoutPreferences() {
  const row = useLiveQuery(
    () => webDb.workout_preferences.get(1) as Promise<PreferencesRow | undefined>,
    []
  );
  const loading = row === undefined;
  const preferences = toPreferences(row);

  const updatePreferences = useCallback(
    async (next: Partial<WorkoutPreferences>) => {
      const merged: WorkoutPreferences = {
        goal: 'general',
        equipment: [],
        timeMinutes: 30,
        ...(preferences ?? undefined),
        ...next,
      };
      // sync_id must be included: Dexie's put() fully replaces the row (not a merge), so omitting
      // it here would wipe the 'singleton' sync_id the populate() seed set — pushLocalRow silently
      // no-ops on a null sync_id, so this table would never sync cross-device after the first save.
      await webDb.workout_preferences.put({
        id: 1,
        goal: merged.goal,
        equipment: JSON.stringify(merged.equipment),
        time_minutes: merged.timeMinutes,
        updated_at: new Date().toISOString(),
        sync_id: 'singleton',
      });
      await pushLocalRow('workout_preferences', 1);
    },
    [preferences]
  );

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { preferences, loading, updatePreferences, refresh };
}
