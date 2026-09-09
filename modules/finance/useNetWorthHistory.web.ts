import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';

import { webDb } from '@/db/webDb';
import { addDays, todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';

import type { NetWorthSnapshot } from './types';

/**
 * Web build of useNetWorthHistory.ts — same shape, reactive via Dexie's useLiveQuery instead of
 * expo-router's useFocusEffect. Syncs like the native build, see db/webDb.ts's v11 store addition.
 */
export function useNetWorthHistory(days: number) {
  const snapshots = useLiveQuery(async () => {
    const start = addDays(todayKey(), -(days - 1));
    const all = (await webDb.finance_networth_snapshots.toArray()) as NetWorthSnapshot[];
    return all.filter((row) => row.date >= start).sort((a, b) => a.date.localeCompare(b.date));
  }, [days]);

  const recordTodaySnapshot = useCallback(async (netWorth: number) => {
    const date = todayKey();
    const existing = await webDb.finance_networth_snapshots.where('date').equals(date).first();
    if (existing) return;
    const now = new Date().toISOString();
    const id = await webDb.finance_networth_snapshots.add({
      date,
      net_worth: netWorth,
      created_at: now,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('finance_networth_snapshots', id as number);
  }, []);

  return { snapshots: snapshots ?? [], loading: snapshots === undefined, recordTodaySnapshot };
}
