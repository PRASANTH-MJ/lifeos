import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

export type FlowLevel = 'light' | 'medium' | 'heavy';

export type CycleLog = {
  id: number;
  date: string;
  flow: FlowLevel | null;
  symptoms: string[];
  notes: string | null;
  /** 1-5 scale, same convention as journal_checkins' energy/stress/productivity — null when not
   * logged for this day. */
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

/** Loads every logged cycle entry, most recent first — the full history (not just a date range)
 * is what prediction and mood-correlation both need, and this dataset stays small (at most a
 * few hundred rows over years of use), so there's no pagination concern here. */
export function useCycleLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<CycleLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<CycleLogRow>('SELECT * FROM cycle_logs ORDER BY date DESC');
    setLogs(rows.map(parseRow));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const upsertLog = useCallback(
    async (
      date: string,
      values: { flow?: FlowLevel | null; symptoms?: string[]; notes?: string | null; mood?: number | null; energy?: number | null }
    ) => {
      const now = new Date().toISOString();
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM cycle_logs WHERE date = ?', [date]);
      if (existing) {
        const current = logs.find((l) => l.id === existing.id);
        const flow = values.flow !== undefined ? values.flow : current?.flow ?? null;
        const symptoms = values.symptoms !== undefined ? values.symptoms : current?.symptoms ?? [];
        const notes = values.notes !== undefined ? values.notes : current?.notes ?? null;
        const mood = values.mood !== undefined ? values.mood : current?.mood ?? null;
        const energy = values.energy !== undefined ? values.energy : current?.energy ?? null;
        await db.runAsync('UPDATE cycle_logs SET flow = ?, symptoms = ?, notes = ?, mood = ?, energy = ?, updated_at = ? WHERE id = ?', [
          flow,
          JSON.stringify(symptoms),
          notes,
          mood,
          energy,
          now,
          existing.id,
        ]);
        await pushLocalRow(db, 'cycle_logs', existing.id);
      } else {
        const result = await db.runAsync(
          'INSERT INTO cycle_logs (date, flow, symptoms, notes, mood, energy, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            date,
            values.flow ?? null,
            JSON.stringify(values.symptoms ?? []),
            values.notes ?? null,
            values.mood ?? null,
            values.energy ?? null,
            now,
            now,
            Crypto.randomUUID(),
          ]
        );
        await pushLocalRow(db, 'cycle_logs', result.lastInsertRowId);
      }
      await refresh();
    },
    [db, logs, refresh]
  );

  const removeLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'cycle_logs', id);
      await db.runAsync('DELETE FROM cycle_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  return { logs, loading, upsertLog, removeLog, refresh };
}
