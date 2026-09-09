import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { BodyMeasurement } from './useBodyMeasurements';

/** Web build of useBodyMeasurements.ts — same exported shape, reactive via useLiveQuery. */
export function useBodyMeasurements() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.body_measurements.toArray()) as unknown as BodyMeasurement[];
    return [...all].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, []);

  const entries = rows ?? [];
  const loading = rows === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addEntry = useCallback(async (date: string, weightKg: number) => {
    const now = new Date().toISOString();
    const existing = await webDb.body_measurements.where('date').equals(date).first();
    const id = existing
      ? ((await webDb.body_measurements.update(existing.id as number, { weight_kg: weightKg, updated_at: now })) && (existing.id as number))
      : ((await webDb.body_measurements.add({ date, weight_kg: weightKg, created_at: now, updated_at: now, sync_id: Crypto.randomUUID() } as never)) as number);
    await pushLocalRow('body_measurements', id);
  }, []);

  const removeEntry = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('body_measurements', id);
    await webDb.body_measurements.delete(id);
  }, []);

  return { entries, loading, addEntry, removeEntry, refresh };
}
