import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync';
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

/** Today's morning/night check-ins — a separate, structured capability alongside the existing
 * free-text journal entries. One row per day per type (enforced by a UNIQUE constraint), so
 * saving again the same day upserts rather than duplicating. */
export function useCheckins(dateKey: string = todayKey()) {
  const db = useSQLiteContext();
  const [morning, setMorning] = useState<JournalCheckin | null>(null);
  const [night, setNight] = useState<JournalCheckin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<CheckinRow>('SELECT * FROM journal_checkins WHERE date = ?', [dateKey]);
      setMorning((rows.find((row) => row.type === 'morning') as JournalCheckin | undefined) ?? null);
      setNight((rows.find((row) => row.type === 'night') as JournalCheckin | undefined) ?? null);
    } finally {
      setLoading(false);
    }
  }, [db, dateKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const saveMorning = useCallback(
    async (values: MorningCheckinInput) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO journal_checkins (date, type, energy, sleep_bucket, stress, first_reached_for, mood, created_at, updated_at, sync_id)
         VALUES (?, 'morning', ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date, type) DO UPDATE SET
           energy = excluded.energy,
           sleep_bucket = excluded.sleep_bucket,
           stress = excluded.stress,
           first_reached_for = excluded.first_reached_for,
           mood = excluded.mood,
           updated_at = excluded.updated_at`,
        [dateKey, values.energy, values.sleepBucket, values.stress, values.firstReachedFor, values.mood, now, now, Crypto.randomUUID()]
      );
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM journal_checkins WHERE date = ? AND type = ?',
        [dateKey, 'morning']
      );
      if (row) await pushLocalRow(db, 'journal_checkins', row.id);
      await refresh();
    },
    [db, dateKey, refresh]
  );

  const saveNight = useCallback(
    async (values: NightCheckinInput) => {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO journal_checkins (date, type, productivity, mood, created_at, updated_at, sync_id)
         VALUES (?, 'night', ?, ?, ?, ?, ?)
         ON CONFLICT(date, type) DO UPDATE SET
           productivity = excluded.productivity,
           mood = excluded.mood,
           updated_at = excluded.updated_at`,
        [dateKey, values.productivity, values.mood, now, now, Crypto.randomUUID()]
      );
      const row = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM journal_checkins WHERE date = ? AND type = ?',
        [dateKey, 'night']
      );
      if (row) await pushLocalRow(db, 'journal_checkins', row.id);
      await refresh();
    },
    [db, dateKey, refresh]
  );

  return { morning, night, loading, saveMorning, saveNight, refresh };
}
