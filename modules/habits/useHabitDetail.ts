import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import { cancelHabitNotifications, syncHabitNotifications } from './scheduleHabitNotifications';
import { computeLongestStreak, computePeriodProgress, computeStreak } from './streak';
import { parseTargetDays, type Habit, type HabitLog, type LogStatus } from './types';
import type { CreateHabitInput, LogValues } from './useHabits';

export function useHabitDetail(habitId: number) {
  const db = useSQLiteContext();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [habitRow, logRows] = await Promise.all([
      db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', [habitId]),
      db.getAllAsync<HabitLog>('SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY date ASC', [habitId]),
    ]);
    setHabit(habitRow);
    setLogs(logRows);
    setLoading(false);
  }, [db, habitId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const upsertLog = useCallback(
    async (date: string, values: LogValues) => {
      const checklistJson = values.checklistChecked ? JSON.stringify(values.checklistChecked) : null;
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, date]
      );
      const now = new Date().toISOString();
      if (existing) {
        await db.runAsync(
          'UPDATE habit_logs SET status = ?, value = ?, checklist_checked = ?, note = ?, completed_at = ?, updated_at = ? WHERE id = ?',
          [values.status, values.value ?? null, checklistJson, values.note ?? null, now, now, existing.id]
        );
        await pushLocalRow(db, 'habit_logs', existing.id);
      } else {
        const result = await db.runAsync(
          `INSERT INTO habit_logs (habit_id, date, status, value, checklist_checked, note, completed_at, sync_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [habitId, date, values.status, values.value ?? null, checklistJson, values.note ?? null, now, Crypto.randomUUID(), now]
        );
        await pushLocalRow(db, 'habit_logs', result.lastInsertRowId);
      }
      await refresh();
    },
    [db, habitId, refresh]
  );

  const clearLog = useCallback(
    async (date: string) => {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, date]
      );
      if (existing) {
        await recordDeleteBeforeRemoving(db, 'habit_logs', existing.id);
      }
      await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, date]);
      await refresh();
    },
    [db, habitId, refresh]
  );

  const updateHabit = useCallback(
    async (values: Partial<CreateHabitInput>) => {
      const columnMap: Record<string, unknown> = {};
      if (values.name !== undefined) columnMap.name = values.name;
      if (values.icon !== undefined) columnMap.icon = values.icon;
      if (values.categoryId !== undefined) columnMap.category_id = values.categoryId;
      if (values.trackingType !== undefined) columnMap.tracking_type = values.trackingType;
      if (values.targetValue !== undefined) columnMap.target_value = values.targetValue;
      if (values.targetUnit !== undefined) columnMap.target_unit = values.targetUnit;
      if (values.targetComparator !== undefined) columnMap.target_comparator = values.targetComparator;
      if (values.checklistItems !== undefined) columnMap.checklist_items = JSON.stringify(values.checklistItems);
      if (values.checklistSuccessMode !== undefined) columnMap.checklist_success_mode = values.checklistSuccessMode;
      if (values.checklistMinCount !== undefined) columnMap.checklist_min_count = values.checklistMinCount;
      if (values.frequency !== undefined) columnMap.frequency = values.frequency;
      if (values.targetDays !== undefined) columnMap.target_days = JSON.stringify(values.targetDays);
      if (values.periodTargetCount !== undefined) columnMap.period_target_count = values.periodTargetCount;
      if (values.periodLengthDays !== undefined) columnMap.period_length_days = values.periodLengthDays;
      if (values.reminderTimes !== undefined) columnMap.reminder_time = values.reminderTimes.length > 0 ? JSON.stringify(values.reminderTimes) : null;
      if (values.alarmEnabled !== undefined) columnMap.alarm_enabled = values.alarmEnabled ? 1 : 0;
      if (values.routineGroup !== undefined) columnMap.routine_group = values.routineGroup?.trim() || null;

      columnMap.updated_at = new Date().toISOString();

      const keys = Object.keys(columnMap);
      if (keys.length === 0) return;
      const setClause = keys.map((key) => `${key} = ?`).join(', ');
      await db.runAsync(`UPDATE habits SET ${setClause} WHERE id = ?`, [...keys.map((key) => columnMap[key] as never), habitId]);
      await pushLocalRow(db, 'habits', habitId);
      const updated = await db.getFirstAsync<Habit>('SELECT * FROM habits WHERE id = ?', [habitId]);
      // Best-effort — never block the save on notification scheduling.
      if (updated) syncHabitNotifications(updated).catch(() => {});
      await refresh();
    },
    [db, habitId, refresh]
  );

  const archiveHabit = useCallback(async () => {
    await db.runAsync('UPDATE habits SET archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), habitId]);
    await pushLocalRow(db, 'habits', habitId);
    cancelHabitNotifications(habitId).catch(() => {});
  }, [db, habitId]);

  const deleteHabit = useCallback(async () => {
    // habit_logs.habit_id is ON DELETE CASCADE (db/schema.ts) — SQLite silently wipes those rows
    // locally once the habit is deleted below, so each must be tombstoned first or another device
    // never learns those logs were removed (and could even resurrect them on its next sync).
    const logRows = await db.getAllAsync<{ id: number }>('SELECT id FROM habit_logs WHERE habit_id = ?', [habitId]);
    for (const row of logRows) {
      await recordDeleteBeforeRemoving(db, 'habit_logs', row.id);
    }
    await recordDeleteBeforeRemoving(db, 'habits', habitId);
    await db.runAsync('DELETE FROM habits WHERE id = ?', [habitId]);
    cancelHabitNotifications(habitId).catch(() => {});
  }, [db, habitId]);

  // "Restart" clears history so streaks/stats start over, without deleting the habit itself.
  const restartProgress = useCallback(async () => {
    const rows = await db.getAllAsync<{ id: number }>('SELECT id FROM habit_logs WHERE habit_id = ?', [habitId]);
    for (const row of rows) {
      await recordDeleteBeforeRemoving(db, 'habit_logs', row.id);
    }
    await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', [habitId]);
    await refresh();
  }, [db, habitId, refresh]);

  const targetDays = habit ? parseTargetDays(habit.target_days) : [];
  const streak = habit ? computeStreak(logs.map((log) => ({ date: log.date, status: log.status as LogStatus })), habit.frequency, targetDays) : 0;
  const longestStreak = habit
    ? computeLongestStreak(logs.map((log) => ({ date: log.date, status: log.status as LogStatus })), habit.frequency, targetDays)
    : 0;
  const periodProgress =
    habit && habit.frequency === 'periodic' && habit.period_length_days
      ? computePeriodProgress(
          logs.filter((log) => log.status === 'done').map((log) => log.date),
          habit.period_length_days
        )
      : null;
  const heatmapValues = Object.fromEntries(logs.filter((log) => log.status === 'done').map((log) => [log.date, 1]));

  return {
    habit,
    logs,
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
