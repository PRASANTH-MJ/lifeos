import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { RoutineDayLog, RoutineProgress } from './useRoutineProgress';

type ProgressRow = { id: number; program_key: string | null; day_index: number; week_number: number; started_at: string | null };
type DayLogRow = { day_key: string; week_number: number; program_key: string };

/** Web build of useRoutineProgress.ts — same exported shape, reactive via Dexie's useLiveQuery. */
export function useRoutineProgress() {
  const row = useLiveQuery(() => webDb.routine_progress.get(1) as Promise<ProgressRow | undefined>, []);
  const loading = row === undefined;
  const progress: RoutineProgress | null =
    row?.program_key ? { programKey: row.program_key, dayIndex: row.day_index, weekNumber: row.week_number, startedAt: row.started_at ?? '' } : null;

  const dayLogRows = useLiveQuery(
    () => (row?.program_key ? webDb.routine_day_logs.where('program_key').equals(row.program_key).toArray() : Promise.resolve([])) as Promise<DayLogRow[]>,
    [row?.program_key]
  );
  const dayLogs: RoutineDayLog[] = (dayLogRows ?? []).map((l) => ({ dayKey: l.day_key, weekNumber: l.week_number }));

  const startProgram = async (programKey: string) => {
    const now = new Date().toISOString();
    await webDb.routine_progress.put({ id: 1, program_key: programKey, day_index: 0, week_number: 1, started_at: now, updated_at: now, sync_id: 'singleton' });
    await pushLocalRow('routine_progress', 1);
  };

  const completeDay = async (params: {
    programKey: string;
    dayKey: string;
    weekNumber: number;
    nextDayIndex: number;
    nextWeekNumber: number;
    durationSeconds?: number | null;
  }) => {
    const now = new Date().toISOString();
    const syncId = Crypto.randomUUID();
    const localId = await webDb.routine_day_logs.add({
      program_key: params.programKey,
      day_key: params.dayKey,
      week_number: params.weekNumber,
      completed_at: now,
      duration_seconds: params.durationSeconds ?? null,
      updated_at: now,
      sync_id: syncId,
    } as never);
    await pushLocalRow('routine_day_logs', localId);
    await webDb.routine_progress.update(1, { day_index: params.nextDayIndex, week_number: params.nextWeekNumber, updated_at: now });
    await pushLocalRow('routine_progress', 1);
  };

  return { progress, dayLogs, loading, startProgram, completeDay };
}
