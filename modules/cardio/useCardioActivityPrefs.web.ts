import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import { DEFAULT_CARDIO_PREFS, type CardioActivity, type CardioActivityPrefs, type CardioFrequency } from './types';

type PrefRow = { id: number; activity: string; is_recurring: number; frequency: string; target_days: string };

/** Web build of useCardioActivityPrefs.ts — same exported shape, reactive via useLiveQuery. */
export function useCardioActivityPrefs() {
  const rows = useLiveQuery(() => webDb.cardio_activities.toArray() as unknown as Promise<PrefRow[]>, []);
  const loading = rows === undefined;

  const prefsByActivity: Record<string, CardioActivityPrefs & { id: number }> = {};
  for (const row of rows ?? []) {
    prefsByActivity[row.activity] = {
      id: row.id,
      isRecurring: row.is_recurring === 1,
      frequency: row.frequency as CardioFrequency,
      targetDays: JSON.parse(row.target_days || '[]'),
    };
  }

  const getPrefs = useCallback((activity: CardioActivity): CardioActivityPrefs => prefsByActivity[activity] ?? DEFAULT_CARDIO_PREFS, [prefsByActivity]);

  const savePrefs = useCallback(
    async (activity: CardioActivity, next: CardioActivityPrefs) => {
      const now = new Date().toISOString();
      const existing = prefsByActivity[activity];
      if (existing) {
        await webDb.cardio_activities.update(existing.id, {
          is_recurring: next.isRecurring ? 1 : 0,
          frequency: next.frequency,
          target_days: JSON.stringify(next.targetDays),
          updated_at: now,
        });
        await pushLocalRow('cardio_activities', existing.id);
      } else {
        // sync_id must be set on insert — pushLocalRow silently no-ops on a null sync_id.
        const id = (await webDb.cardio_activities.add({
          activity,
          is_recurring: next.isRecurring ? 1 : 0,
          frequency: next.frequency,
          target_days: JSON.stringify(next.targetDays),
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;
        await pushLocalRow('cardio_activities', id);
      }
    },
    [prefsByActivity]
  );

  return { getPrefs, savePrefs, loading };
}
