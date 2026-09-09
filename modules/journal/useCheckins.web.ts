import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { FirstReachedFor, JournalCheckin, MorningCheckinInput, NightCheckinInput, SleepBucket } from './types';

type CheckinRow = {
  id: number;
  date: string;
  type: 'morning' | 'night';
  energy: number | null;
  sleep_bucket: SleepBucket | null;
  stress: number | null;
  first_reached_for: FirstReachedFor | null;
  productivity: number | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
};

/** Web build of useCheckins.ts — same exported shape. Reactive via useLiveQuery instead of the
 * native useFocusEffect-based refresh: any write to journal_checkins (this tab, another tab, or
 * a sync merge) re-runs the query automatically. `date + type` UNIQUE is enforced here by the
 * Dexie `&[date+type]` index (see db/webDb.ts) and by explicitly locating the existing row (if
 * any) for that key and updating it in place instead of blind-inserting, replicating the SQL
 * `ON CONFLICT(date, type) DO UPDATE` upsert. */
export function useCheckins(dateKey: string = todayKey()) {
  // journal_checkins has no standalone 'date' index (only the compound &[date+type]) — filter
  // client-side rather than .where('date'), which would throw a Dexie SchemaError.
  const rows = useLiveQuery(
    async () => ((await webDb.journal_checkins.toArray()) as CheckinRow[]).filter((row) => row.date === dateKey),
    [dateKey]
  );

  const loading = rows === undefined;
  const morning = (rows?.find((row) => row.type === 'morning') as JournalCheckin | undefined) ?? null;
  const night = (rows?.find((row) => row.type === 'night') as JournalCheckin | undefined) ?? null;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  const saveMorning = useCallback(
    async (values: MorningCheckinInput) => {
      const now = new Date().toISOString();
      const existing = (await webDb.journal_checkins
        .where('[date+type]')
        .equals([dateKey, 'morning'])
        .first()) as CheckinRow | undefined;

      let id: number;
      if (existing) {
        id = existing.id;
        await webDb.journal_checkins.update(id, {
          energy: values.energy,
          sleep_bucket: values.sleepBucket,
          stress: values.stress,
          first_reached_for: values.firstReachedFor,
          mood: values.mood,
          updated_at: now,
        });
      } else {
        id = (await webDb.journal_checkins.add({
          date: dateKey,
          type: 'morning',
          energy: values.energy,
          sleep_bucket: values.sleepBucket,
          stress: values.stress,
          first_reached_for: values.firstReachedFor,
          productivity: null,
          mood: values.mood,
          created_at: now,
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;
      }
      await pushLocalRow('journal_checkins', id);
    },
    [dateKey]
  );

  const saveNight = useCallback(
    async (values: NightCheckinInput) => {
      const now = new Date().toISOString();
      const existing = (await webDb.journal_checkins
        .where('[date+type]')
        .equals([dateKey, 'night'])
        .first()) as CheckinRow | undefined;

      let id: number;
      if (existing) {
        id = existing.id;
        await webDb.journal_checkins.update(id, {
          productivity: values.productivity,
          mood: values.mood,
          updated_at: now,
        });
      } else {
        id = (await webDb.journal_checkins.add({
          date: dateKey,
          type: 'night',
          energy: null,
          sleep_bucket: null,
          stress: null,
          first_reached_for: null,
          productivity: values.productivity,
          mood: values.mood,
          created_at: now,
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;
      }
      await pushLocalRow('journal_checkins', id);
    },
    [dateKey]
  );

  return { morning, night, loading, saveMorning, saveNight, refresh };
}
