import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { MeditationLog } from './types';

/**
 * Web build of useMeditationLogs.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab flows into every mounted
 * useMeditationLogs() instance automatically, so no manual refresh-on-focus is needed.
 */
export function useMeditationLogs() {
  const logs = useLiveQuery(
    async () => {
      const rows = await webDb.meditation_logs.orderBy('completed_at').reverse().toArray();
      // 400, not 60 — see useMeditationLogs.ts's native counterpart for why.
      return rows.slice(0, 400) as unknown as MeditationLog[];
    },
    [],
    undefined as unknown as MeditationLog[]
  );

  const loading = logs === undefined;
  const resolvedLogs = logs ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const logSession = useCallback(
    async (sessionKey: string, durationSeconds: number, dateKey?: string) => {
      const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
      const syncId = Crypto.randomUUID();
      const id = await webDb.meditation_logs.add({
        session_key: sessionKey,
        duration_seconds: Math.round(durationSeconds),
        completed_at: completedAt,
        sync_id: syncId,
        updated_at: completedAt,
      } as never);
      await pushLocalRow('meditation_logs', id as number);
    },
    []
  );

  const totalMinutesThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    const totalSeconds = resolvedLogs
      .filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo)
      .reduce((sum, log) => sum + log.duration_seconds, 0);
    return Math.round(totalSeconds / 60);
  }, [resolvedLogs]);

  return { logs: resolvedLogs, loading, logSession, totalMinutesThisWeek, refresh };
}
