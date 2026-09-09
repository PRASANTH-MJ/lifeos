import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

export type FlowLevel = 'light' | 'medium' | 'heavy';

export type CycleLog = {
  id: number;
  date: string;
  flow: FlowLevel | null;
  symptoms: string[];
  notes: string | null;
  mood: number | null;
  energy: number | null;
};

type CycleLogRow = {
  id: number;
  date: string;
  flow: string | null;
  symptoms: string;
  notes: string | null;
  mood: number | null;
  energy: number | null;
};

function parseRow(row: CycleLogRow): CycleLog {
  return {
    id: row.id,
    date: row.date,
    flow: (row.flow as FlowLevel) ?? null,
    symptoms: JSON.parse(row.symptoms || '[]'),
    notes: row.notes,
    mood: row.mood,
    energy: row.energy,
  };
}

/**
 * Web build of useCycleLogs.ts — same exported shape. Reactive via useLiveQuery instead of the
 * native useFocusEffect-based refresh: every tab's view updates automatically the instant any
 * tab (or the sync engine) writes to cycle_logs. `refresh` is kept as a no-op-returning function
 * only so callers that `await refresh()` don't need changing.
 */
export function useCycleLogs() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.cycle_logs.toArray()) as unknown as CycleLogRow[];
    return [...all].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, []);

  const logs = (rows ?? []).map(parseRow);
  const loading = rows === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const upsertLog = useCallback(
    async (
      date: string,
      values: { flow?: FlowLevel | null; symptoms?: string[]; notes?: string | null; mood?: number | null; energy?: number | null }
    ) => {
      const now = new Date().toISOString();
      const existing = (await webDb.cycle_logs.where('date').equals(date).first()) as CycleLogRow | undefined;
      if (existing) {
        const current = logs.find((l) => l.id === existing.id);
        const flow = values.flow !== undefined ? values.flow : current?.flow ?? null;
        const symptoms = values.symptoms !== undefined ? values.symptoms : current?.symptoms ?? [];
        const notes = values.notes !== undefined ? values.notes : current?.notes ?? null;
        const mood = values.mood !== undefined ? values.mood : current?.mood ?? null;
        const energy = values.energy !== undefined ? values.energy : current?.energy ?? null;
        await webDb.cycle_logs.update(existing.id, {
          flow,
          symptoms: JSON.stringify(symptoms),
          notes,
          mood,
          energy,
          updated_at: now,
        });
        await pushLocalRow('cycle_logs', existing.id);
      } else {
        const id = (await webDb.cycle_logs.add({
          date,
          flow: values.flow ?? null,
          symptoms: JSON.stringify(values.symptoms ?? []),
          notes: values.notes ?? null,
          mood: values.mood ?? null,
          energy: values.energy ?? null,
          created_at: now,
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;
        await pushLocalRow('cycle_logs', id);
      }
    },
    [logs]
  );

  const removeLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('cycle_logs', id);
    await webDb.cycle_logs.delete(id);
  }, []);

  return { logs, loading, upsertLog, removeLog, refresh };
}
