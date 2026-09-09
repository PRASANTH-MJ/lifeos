import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { showAlert } from '@/components';
import { onLocalWrite, pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import type { CardioActivity, CardioIntensity, CardioLog, CardioMood, CardioWeather } from './types';
import type { RoutePoint } from './locationTracking';

/** Guards against the two realistic double-log causes for cardio (a double "Save" tap, or a
 * flaky-network retry) — same activity+date logged again within this window, at a near-identical
 * distance, is treated as "probably the same session" and prompts a confirm rather than silently
 * writing a second row. Deliberately loose/dismissible (see addLog below): two genuinely separate
 * short sessions logged back-to-back must still be one tap away from saving. */
const DUPLICATE_WINDOW_MS = 10_000;
const DUPLICATE_DISTANCE_TOLERANCE_KM = 0.05;

async function findRecentSimilarCardioLog(
  db: SQLiteDatabase,
  activity: CardioActivity,
  date: string,
  distanceKm: number | null
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const rows = await db.getAllAsync<{ distance_km: number | null }>(
    'SELECT distance_km FROM cardio_logs WHERE activity = ? AND date = ? AND created_at >= ?',
    [activity, date, cutoff]
  );
  return rows.some((row) =>
    distanceKm == null
      ? row.distance_km == null
      : row.distance_km != null && Math.abs(row.distance_km - distanceKm) <= DUPLICATE_DISTANCE_TOLERANCE_KM
  );
}

function confirmSaveDuplicate(): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(
      'Possible duplicate',
      'This looks like a duplicate of an entry from a moment ago — save anyway?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Save anyway', onPress: () => resolve(true) },
      ]
    );
  });
}

type CardioLogRow = {
  id: number;
  activity: string;
  date: string;
  distance_km: number | null;
  duration_minutes: number;
  sport_name: string | null;
  intensity: string | null;
  note: string | null;
  route_points: string | null;
  mood: string | null;
  photo_uri: string | null;
  elevation_gain_m: number | null;
  combo_group_id: string | null;
  weather: string | null;
  created_at: string;
};

function parseRow(row: CardioLogRow): CardioLog {
  return {
    id: row.id,
    activity: row.activity as CardioActivity,
    date: row.date,
    distanceKm: row.distance_km,
    durationMinutes: row.duration_minutes,
    sportName: row.sport_name,
    intensity: row.intensity as CardioIntensity | null,
    note: row.note,
    routePoints: row.route_points ? (JSON.parse(row.route_points) as RoutePoint[]) : null,
    mood: row.mood as CardioMood | null,
    photoUri: row.photo_uri,
    elevationGainM: row.elevation_gain_m,
    comboGroupId: row.combo_group_id ?? null,
    weather: (row.weather as CardioWeather | null) ?? null,
    createdAt: row.created_at,
  };
}

/** Every logged cardio session across all five activities — the full history, not just one
 * activity's, since level progress (see levels.ts) needs the whole cumulative picture and this
 * dataset stays small enough that filtering client-side per activity is simpler than five
 * separate queries. */
export function useCardioLogs() {
  const db = useSQLiteContext();
  const [logs, setLogs] = useState<CardioLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<CardioLogRow>('SELECT * FROM cardio_logs ORDER BY date DESC, id DESC');
    setLogs(rows.map(parseRow));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // See onLocalWrite's doc comment — picks up a cardio_logs write made through a different
  // useCardioLogs() instance (e.g. usePublicProfileStatsSync's, mounted once at the root layout
  // and never "focused" again by navigation) instead of only ever seeing its own writes.
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'cardio_logs') refresh();
    });
  }, [refresh]);

  const addLog = useCallback(
    async (values: {
      activity: CardioActivity;
      date: string;
      distanceKm: number | null;
      durationMinutes: number;
      sportName?: string | null;
      intensity?: CardioIntensity | null;
      note?: string | null;
      routePoints?: RoutePoint[] | null;
      mood?: CardioMood | null;
      photoUri?: string | null;
      elevationGainM?: number | null;
      comboGroupId?: string | null;
      weather?: CardioWeather | null;
    }) => {
      const isDuplicate = await findRecentSimilarCardioLog(db, values.activity, values.date, values.distanceKm);
      if (isDuplicate && !(await confirmSaveDuplicate())) return false;

      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO cardio_logs (activity, date, distance_km, duration_minutes, sport_name, intensity, note, route_points, mood, photo_uri, elevation_gain_m, combo_group_id, weather, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          values.activity,
          values.date,
          values.distanceKm,
          values.durationMinutes,
          values.sportName ?? null,
          values.intensity ?? null,
          values.note ?? null,
          values.routePoints ? JSON.stringify(values.routePoints) : null,
          values.mood ?? null,
          values.photoUri ?? null,
          values.elevationGainM ?? null,
          values.comboGroupId ?? null,
          values.weather ?? null,
          now,
          now,
          Crypto.randomUUID(),
        ]
      );
      await pushLocalRow(db, 'cardio_logs', result.lastInsertRowId);
      await refresh();
      return true;
    },
    [db, refresh]
  );

  const removeLog = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'cardio_logs', id);
      await db.runAsync('DELETE FROM cardio_logs WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  return { logs, loading, addLog, removeLog, refresh };
}
