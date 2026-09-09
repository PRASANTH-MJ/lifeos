import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { showAlert } from '@/components';
import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { CardioActivity, CardioIntensity, CardioLog, CardioMood, CardioWeather } from './types';
import type { RoutePoint } from './locationTracking';

/** Web mirror of useCardioLogs.ts's duplicate guard — see that file's doc comment. */
const DUPLICATE_WINDOW_MS = 10_000;
const DUPLICATE_DISTANCE_TOLERANCE_KM = 0.05;

async function findRecentSimilarCardioLog(activity: CardioActivity, date: string, distanceKm: number | null): Promise<boolean> {
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const rows = (await webDb.cardio_logs
    .where('activity')
    .equals(activity)
    .toArray()) as unknown as { date: string; distance_km: number | null; created_at: string }[];
  return rows.some(
    (row) =>
      row.date === date &&
      row.created_at >= cutoff &&
      (distanceKm == null
        ? row.distance_km == null
        : row.distance_km != null && Math.abs(row.distance_km - distanceKm) <= DUPLICATE_DISTANCE_TOLERANCE_KM)
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
    sportName: row.sport_name ?? null,
    intensity: (row.intensity as CardioIntensity | null) ?? null,
    note: row.note,
    routePoints: row.route_points ? (JSON.parse(row.route_points) as RoutePoint[]) : null,
    mood: (row.mood as CardioMood | null) ?? null,
    photoUri: row.photo_uri ?? null,
    elevationGainM: row.elevation_gain_m ?? null,
    comboGroupId: row.combo_group_id ?? null,
    weather: (row.weather as CardioWeather | null) ?? null,
    createdAt: row.created_at,
  };
}

/** Web build of useCardioLogs.ts — same exported shape, reactive via useLiveQuery. */
export function useCardioLogs() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.cardio_logs.toArray()) as unknown as CardioLogRow[];
    return [...all].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }, []);

  const logs = (rows ?? []).map(parseRow);
  const loading = rows === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

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
      const isDuplicate = await findRecentSimilarCardioLog(values.activity, values.date, values.distanceKm);
      if (isDuplicate && !(await confirmSaveDuplicate())) return false;

      const now = new Date().toISOString();
      const id = (await webDb.cardio_logs.add({
        activity: values.activity,
        date: values.date,
        distance_km: values.distanceKm,
        duration_minutes: values.durationMinutes,
        sport_name: values.sportName ?? null,
        intensity: values.intensity ?? null,
        note: values.note ?? null,
        route_points: values.routePoints ? JSON.stringify(values.routePoints) : null,
        mood: values.mood ?? null,
        photo_uri: values.photoUri ?? null,
        elevation_gain_m: values.elevationGainM ?? null,
        combo_group_id: values.comboGroupId ?? null,
        weather: values.weather ?? null,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
      } as never)) as number;
      await pushLocalRow('cardio_logs', id);
      return true;
    },
    []
  );

  const removeLog = useCallback(async (id: number) => {
    await recordDeleteBeforeRemoving('cardio_logs', id);
    await webDb.cardio_logs.delete(id);
  }, []);

  return { logs, loading, addLog, removeLog, refresh };
}
