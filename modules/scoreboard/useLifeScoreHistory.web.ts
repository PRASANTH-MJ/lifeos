import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';

import { webDb } from '@/db/webDb';
import { addDays, todayKey } from '@/lib/date';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';

import type { LifeScoreArea, LifeScoreSnapshot } from './useLifeScore';

const HISTORY_DAYS = 14;

/**
 * Web build of useLifeScoreHistory.ts — same shape, reactive via Dexie's useLiveQuery instead of
 * expo-router's useFocusEffect. Syncs like the native build, see db/webDb.ts's v11 store addition.
 */
export function useLifeScoreHistory() {
  const snapshots = useLiveQuery(async () => {
    const start = addDays(todayKey(), -(HISTORY_DAYS - 1));
    const all = (await webDb.life_score_snapshots.toArray()) as LifeScoreSnapshot[];
    return all.filter((row) => row.date >= start).sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const recordTodaySnapshot = useCallback(async (scores: Record<LifeScoreArea, number>, overall: number) => {
    const date = todayKey();
    const existing = await webDb.life_score_snapshots.where('date').equals(date).first();
    if (existing) return;
    const now = new Date().toISOString();
    const id = await webDb.life_score_snapshots.add({
      date,
      physical: scores.physical,
      mental: scores.mental,
      spiritual: scores.spiritual,
      financial: scores.financial,
      relationship: scores.relationship,
      overall,
      created_at: now,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('life_score_snapshots', id as number);
  }, []);

  return { snapshots: snapshots ?? [], loading: snapshots === undefined, recordTodaySnapshot };
}
