import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { addDays, todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync';

import type { LifeScoreArea, LifeScoreSnapshot } from './useLifeScore';

const HISTORY_DAYS = 14;

/**
 * Daily snapshot history for the Life Scoreboard — one row per calendar day, written once per day
 * by the scoreboard screen itself via `recordTodaySnapshot` (called on load; a no-op if today's
 * row already exists) rather than any background job. Syncs like any other table (see
 * db/schema.ts's v66 migration) so the trend chart matches across devices, even though it's a
 * derived cache of scores already computed from data that syncs via its own source tables.
 */
export function useLifeScoreHistory() {
  const db = useSQLiteContext();
  const [snapshots, setSnapshots] = useState<LifeScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const start = addDays(todayKey(), -(HISTORY_DAYS - 1));
    const rows = await db.getAllAsync<LifeScoreSnapshot>(
      'SELECT date, physical, mental, spiritual, financial, relationship, overall FROM life_score_snapshots WHERE date >= ? ORDER BY date',
      [start]
    );
    setSnapshots(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const recordTodaySnapshot = useCallback(
    async (scores: Record<LifeScoreArea, number>, overall: number) => {
      const date = todayKey();
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM life_score_snapshots WHERE date = ?', [date]);
      if (existing) return;
      const now = new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO life_score_snapshots (date, physical, mental, spiritual, financial, relationship, overall, created_at, updated_at, sync_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [date, scores.physical, scores.mental, scores.spiritual, scores.financial, scores.relationship, overall, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'life_score_snapshots', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  return { snapshots, loading, recordTodaySnapshot };
}
