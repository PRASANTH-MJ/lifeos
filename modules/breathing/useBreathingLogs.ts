import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { onLocalWrite, pushLocalRow } from '@/modules/sync';
import type { BreathingLog } from './types';

export function useBreathingLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<BreathingLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<BreathingLog>('SELECT * FROM breathing_logs ORDER BY completed_at DESC LIMIT 60');
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // See onLocalWrite's doc comment (modules/sync/syncEngine.ts) — picks up a breathing_logs write
  // made through a different useBreathingLogs() instance (e.g. usePublicProfileStatsSync's,
  // mounted once at the root layout and never "focused" again by navigation).
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'breathing_logs') refresh();
    });
  }, [refresh]);

  const logSession = useCallback(
    async (patternKey: string, durationSeconds: number, cycles: number, dateKey?: string) => {
      const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO breathing_logs (pattern_key, duration_seconds, cycles, completed_at, sync_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [patternKey, Math.round(durationSeconds), cycles, completedAt, Crypto.randomUUID(), completedAt]
      );
      await pushLocalRow(db, 'breathing_logs', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return logs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [logs]);

  return { logs, loading, logSession, sessionsThisWeek, refresh };
}
