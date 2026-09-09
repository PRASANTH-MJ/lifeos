import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow } from '@/modules/sync';

export type CyclePreferences = {
  trackingEnabled: boolean;
  averageCycleLength: number;
  averagePeriodLength: number;
};

type PrefRow = {
  tracking_enabled: number;
  average_cycle_length: number;
  average_period_length: number;
};

export function useCyclePreferences() {
  const db = useSQLiteContext();
  const [prefs, setPrefs] = useState<CyclePreferences>({
    trackingEnabled: false,
    averageCycleLength: 28,
    averagePeriodLength: 5,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<PrefRow>(
      'SELECT tracking_enabled, average_cycle_length, average_period_length FROM cycle_preferences WHERE id = 1'
    );
    if (row) {
      setPrefs({
        trackingEnabled: row.tracking_enabled === 1,
        averageCycleLength: row.average_cycle_length,
        averagePeriodLength: row.average_period_length,
      });
    }
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const update = useCallback(
    async (next: Partial<CyclePreferences>) => {
      const merged = { ...prefs, ...next };
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO cycle_preferences (id, tracking_enabled, average_cycle_length, average_period_length, updated_at)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET tracking_enabled = excluded.tracking_enabled,
           average_cycle_length = excluded.average_cycle_length, average_period_length = excluded.average_period_length,
           updated_at = excluded.updated_at`,
        [merged.trackingEnabled ? 1 : 0, merged.averageCycleLength, merged.averagePeriodLength, now]
      );
      await pushLocalRow(db, 'cycle_preferences', 1);
      await refresh();
    },
    [db, prefs, refresh]
  );

  return { ...prefs, loading, update, refresh };
}
