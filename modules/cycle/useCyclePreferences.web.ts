import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';

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

const DEFAULTS: CyclePreferences = {
  trackingEnabled: false,
  averageCycleLength: 28,
  averagePeriodLength: 5,
};

function toPrefs(row: PrefRow | undefined | null): CyclePreferences {
  if (!row) return DEFAULTS;
  return {
    trackingEnabled: row.tracking_enabled === 1,
    averageCycleLength: row.average_cycle_length,
    averagePeriodLength: row.average_period_length,
  };
}

/**
 * Web build of useCyclePreferences.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine) flows into
 * every mounted useCyclePreferences() instance automatically.
 */
export function useCyclePreferences() {
  const row = useLiveQuery(() => webDb.cycle_preferences.get(1) as Promise<PrefRow | undefined>, []);
  const loading = row === undefined;
  const prefs = toPrefs(row);

  const update = useCallback(
    async (next: Partial<CyclePreferences>) => {
      const merged = { ...prefs, ...next };
      const now = new Date().toISOString();
      // ON CONFLICT(id) DO UPDATE in the native SQL -> put() always replaces the id=1 row
      // (an insert on first write, an in-place replace on every subsequent write).
      // sync_id included because put() fully replaces the row — omitting it would wipe the
      // seeded 'singleton' sync_id and permanently stop this table from syncing cross-device.
      await webDb.cycle_preferences.put({
        id: 1,
        tracking_enabled: merged.trackingEnabled ? 1 : 0,
        average_cycle_length: merged.averageCycleLength,
        average_period_length: merged.averagePeriodLength,
        updated_at: now,
        sync_id: 'singleton',
      });
      await pushLocalRow('cycle_preferences', 1);
    },
    [prefs]
  );

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { ...prefs, loading, update, refresh };
}
