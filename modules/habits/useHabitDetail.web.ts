import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import { cancelHabitNotifications, syncHabitNotifications } from './scheduleHabitNotifications';
import { computeLongestStreak, computePeriodProgress, computeStreak } from './streak';
import { parseTargetDays, type Habit, type HabitLog, type LogStatus } from './types';
import type { CreateHabitInput, LogValues } from './useHabits';
import {
  assertValidLogStatus,
  VALID_TRACKING_TYPES,
  VALID_TARGET_COMPARATORS,
  VALID_CHECKLIST_MODES,
  VALID_FREQUENCIES,
} from './useHabits.web';

/**
 * Web build of useHabitDetail.ts — same exported shape. Reactive via useLiveQuery instead of
 * expo-router's useFocusEffect: a write to `habits`/`habit_logs` from this tab, another tab, or
 * a sync merge re-runs the query automatically, so no manual refresh() call is needed after any
 * mutation (kept as a callable no-op only so callers that awaited it don't need changing).
 */
export function useHabitDetail(habitId: number) {
  const habit = useLiveQuery(
    () => webDb.habits.get(habitId) as Promise<Habit | undefined>,
    [habitId]
  );

  const logs = useLiveQuery(
    async () => {
      const rows = (await webDb.habit_logs
        .where('habit_id')
        .equals(habitId)
        .toArray()) as HabitLog[];
      return [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },
    [habitId]
  );

  const loading = habit === undefined || logs === undefined;
  const resolvedHabit = habit ?? null;
  const resolvedLogs = logs ?? [];

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const upsertLog = useCallback(
    async (date: string, values: LogValues) => {
      assertValidLogStatus(values.status);
      const checklistJson = values.checklistChecked ? JSON.stringify(values.checklistChecked) : null;
      const existing = await webDb.habit_logs
        .where('[habit_id+date]')
        .equals([habitId, date])
        .first();
      const now = new Date().toISOString();
      if (existing) {
        await webDb.habit_logs.update((existing as { id: number }).id, {
          status: values.status,
          value: values.value ?? null,
          checklist_checked: checklistJson,
          note: values.note ?? null,
          completed_at: now,
          updated_at: now,
        });
        await pushLocalRow('habit_logs', (existing as { id: number }).id);
      } else {
        const id = await webDb.habit_logs.add({
          habit_id: habitId,
          date,
          status: values.status,
          value: values.value ?? null,
          checklist_checked: checklistJson,
          note: values.note ?? null,
          completed_at: now,
          sync_id: Crypto.randomUUID(),
          updated_at: now,
        } as never);
        await pushLocalRow('habit_logs', id as number);
      }
    },
    [habitId]
  );

  const clearLog = useCallback(
    async (date: string) => {
      const existing = await webDb.habit_logs
        .where('[habit_id+date]')
        .equals([habitId, date])
        .first();
      if (existing) {
        await recordDeleteBeforeRemoving('habit_logs', (existing as { id: number }).id);
        await webDb.habit_logs.delete((existing as { id: number }).id);
      }
    },
    [habitId]
  );

  const updateHabit = useCallback(
    async (values: Partial<CreateHabitInput>) => {
      const columnMap: Record<string, unknown> = {};
      if (values.name !== undefined) columnMap.name = values.name;
      if (values.icon !== undefined) columnMap.icon = values.icon;
      if (values.categoryId !== undefined) columnMap.category_id = values.categoryId;
      if (values.trackingType !== undefined) {
        if (!VALID_TRACKING_TYPES.includes(values.trackingType)) throw new Error(`Invalid tracking_type "${values.trackingType}"`);
        columnMap.tracking_type = values.trackingType;
      }
      if (values.targetValue !== undefined) columnMap.target_value = values.targetValue;
      if (values.targetUnit !== undefined) columnMap.target_unit = values.targetUnit;
      if (values.targetComparator !== undefined) {
        if (!VALID_TARGET_COMPARATORS.includes(values.targetComparator)) throw new Error(`Invalid target_comparator "${values.targetComparator}"`);
        columnMap.target_comparator = values.targetComparator;
      }
      if (values.checklistItems !== undefined) columnMap.checklist_items = JSON.stringify(values.checklistItems);
      if (values.checklistSuccessMode !== undefined) {
        if (!VALID_CHECKLIST_MODES.includes(values.checklistSuccessMode as never)) {
          throw new Error(`Invalid checklist_success_mode "${values.checklistSuccessMode}"`);
        }
        columnMap.checklist_success_mode = values.checklistSuccessMode;
      }
      if (values.checklistMinCount !== undefined) columnMap.checklist_min_count = values.checklistMinCount;
      if (values.frequency !== undefined) {
        if (!VALID_FREQUENCIES.includes(values.frequency)) throw new Error(`Invalid frequency "${values.frequency}"`);
        columnMap.frequency = values.frequency;
      }
      if (values.targetDays !== undefined) columnMap.target_days = JSON.stringify(values.targetDays);
      if (values.periodTargetCount !== undefined) columnMap.period_target_count = values.periodTargetCount;
      if (values.periodLengthDays !== undefined) columnMap.period_length_days = values.periodLengthDays;
      if (values.reminderTimes !== undefined) columnMap.reminder_time = values.reminderTimes.length > 0 ? JSON.stringify(values.reminderTimes) : null;
      if (values.alarmEnabled !== undefined) columnMap.alarm_enabled = values.alarmEnabled ? 1 : 0;
      if (values.routineGroup !== undefined) columnMap.routine_group = values.routineGroup?.trim() || null;

      columnMap.updated_at = new Date().toISOString();

      const keys = Object.keys(columnMap);
      if (keys.length === 0) return;
      await webDb.habits.update(habitId, columnMap);
      await pushLocalRow('habits', habitId);
      const updated = (await webDb.habits.get(habitId)) as Habit | undefined;
      // Best-effort — never block the save on notification scheduling.
      if (updated) syncHabitNotifications(updated).catch(() => {});
    },
    [habitId]
  );

  const archiveHabit = useCallback(async () => {
    await webDb.habits.update(habitId, { archived: 1, updated_at: new Date().toISOString() });
    await pushLocalRow('habits', habitId);
    cancelHabitNotifications(habitId).catch(() => {});
  }, [habitId]);

  const deleteHabit = useCallback(async () => {
    await recordDeleteBeforeRemoving('habits', habitId);
    await webDb.habits.delete(habitId);
    cancelHabitNotifications(habitId).catch(() => {});
  }, [habitId]);

  // "Restart" clears history so streaks/stats start over, without deleting the habit itself.
  const restartProgress = useCallback(async () => {
    const rows = (await webDb.habit_logs.where('habit_id').equals(habitId).toArray()) as { id: number }[];
    for (const row of rows) {
      await recordDeleteBeforeRemoving('habit_logs', row.id);
    }
    await webDb.habit_logs.where('habit_id').equals(habitId).delete();
  }, [habitId]);

  const targetDays = resolvedHabit ? parseTargetDays(resolvedHabit.target_days) : [];
  const streak = resolvedHabit
    ? computeStreak(resolvedLogs.map((log) => ({ date: log.date, status: log.status as LogStatus })), resolvedHabit.frequency, targetDays)
    : 0;
  const longestStreak = resolvedHabit
    ? computeLongestStreak(resolvedLogs.map((log) => ({ date: log.date, status: log.status as LogStatus })), resolvedHabit.frequency, targetDays)
    : 0;
  const periodProgress =
    resolvedHabit && resolvedHabit.frequency === 'periodic' && resolvedHabit.period_length_days
      ? computePeriodProgress(
          resolvedLogs.filter((log) => log.status === 'done').map((log) => log.date),
          resolvedHabit.period_length_days
        )
      : null;
  const heatmapValues = Object.fromEntries(resolvedLogs.filter((log) => log.status === 'done').map((log) => [log.date, 1]));

  return {
    habit: resolvedHabit,
    logs: resolvedLogs,
    loading,
    heatmapValues,
    streak,
    longestStreak,
    periodProgress,
    upsertLog,
    clearLog,
    updateHabit,
    archiveHabit,
    deleteHabit,
    restartProgress,
    refresh,
  };
}
