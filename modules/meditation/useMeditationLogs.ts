import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { onLocalWrite, pushLocalRow } from '@/modules/sync';
import type { MeditationLog } from './types';

export function useMeditationLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<MeditationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // 400, not 60 — the heatmap on the Meditation hub needs roughly the last 4 months of history
    // (see toDailyMinutes below), which a daily-or-more meditator can easily exceed at 60 rows.
    const rows = await db.getAllAsync<MeditationLog>(
      'SELECT * FROM meditation_logs ORDER BY completed_at DESC LIMIT 400'
    );
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // See onLocalWrite's doc comment (modules/sync/syncEngine.ts) — picks up a meditation_logs
  // write made through a different useMeditationLogs() instance (e.g. usePublicProfileStatsSync's,
  // mounted once at the root layout and never "focused" again by navigation).
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'meditation_logs') refresh();
    });
  }, [refresh]);

  const logSession = useCallback(
    async (sessionKey: string, durationSeconds: number, dateKey?: string) => {
      const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO meditation_logs (session_key, duration_seconds, completed_at, sync_id, updated_at) VALUES (?, ?, ?, ?, ?)',
        [sessionKey, Math.round(durationSeconds), completedAt, Crypto.randomUUID(), completedAt]
      );
      await pushLocalRow(db, 'meditation_logs', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const totalMinutesThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    const totalSeconds = logs
      .filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo)
      .reduce((sum, log) => sum + log.duration_seconds, 0);
    return Math.round(totalSeconds / 60);
  }, [logs]);

  return { logs, loading, logSession, totalMinutesThisWeek, refresh };
}
