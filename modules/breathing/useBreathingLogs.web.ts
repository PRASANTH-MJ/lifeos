import * as Crypto from 'expo-crypto';
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { addDays, dateKeyToTimestamp, toDateKey, todayKey } from '@/lib/date';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { BreathingLog } from './types';

/**
 * Web build of useBreathingLogs.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any tab's logSession() (or a sync merge) makes every
 * mounted instance of this hook re-render automatically.
 */
export function useBreathingLogs() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.breathing_logs.toArray()) as BreathingLog[];
    return [...all]
      .sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : 0))
      .slice(0, 60);
  }, []);

  const logs = rows ?? [];
  const loading = rows === undefined;

  const logSession = useCallback(
    async (patternKey: string, durationSeconds: number, cycles: number, dateKey?: string) => {
      const completedAt = dateKey ? dateKeyToTimestamp(dateKey) : new Date().toISOString();
      const id = await webDb.breathing_logs.add({
        pattern_key: patternKey,
        duration_seconds: Math.round(durationSeconds),
        cycles,
        completed_at: completedAt,
        sync_id: Crypto.randomUUID(),
        updated_at: completedAt,
      } as never);
      await pushLocalRow('breathing_logs', id as number);
    },
    []
  );

  const sessionsThisWeek = useMemo(() => {
    const weekAgo = addDays(todayKey(), -6);
    return logs.filter((log) => toDateKey(new Date(log.completed_at)) >= weekAgo).length;
  }, [logs]);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  return { logs, loading, logSession, sessionsThisWeek, refresh };
}
