import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { addDays, todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync';

import type { NetWorthSnapshot } from './types';

/**
 * Daily net-worth snapshot history — one row per calendar day, written once per day by the
 * analytics screen's Net Worth section via `recordTodaySnapshot` (called on load; a no-op if
 * today's row already exists), same pattern as modules/scoreboard/useLifeScoreHistory.ts. Syncs
 * like any other table (see db/schema.ts's v66 migration) so the trend chart matches across
 * devices, even though it's a derived cache of a figure computed from finance_accounts/
 * finance_debts, which sync via their own rows.
 */
export function useNetWorthHistory(days: number) {
  const db = useSQLiteContext();
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const start = addDays(todayKey(), -(days - 1));
      const rows = await db.getAllAsync<NetWorthSnapshot>(
        'SELECT date, net_worth FROM finance_networth_snapshots WHERE date >= ? ORDER BY date',
        [start]
      );
      setSnapshots(rows);
    } finally {
      setLoading(false);
    }
  }, [db, days]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const recordTodaySnapshot = useCallback(
    async (netWorth: number) => {
      const date = todayKey();
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM finance_networth_snapshots WHERE date = ?', [date]);
      if (existing) return;
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO finance_networth_snapshots (date, net_worth, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?)',
        [date, netWorth, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'finance_networth_snapshots', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  return { snapshots, loading, recordTodaySnapshot };
}
