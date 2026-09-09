import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { useLocalTable } from '@/db';
import { onLocalWrite, pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import { todayKey } from '@/lib/date';
import { syncHabitNotifications } from './scheduleHabitNotifications';
import { computePeriodProgress, computeStreak } from './streak';
import {
  parseTargetDays,
  type Habit,
  type HabitFrequency,
  type HabitLog,
  type LogStatus,
  type TargetComparator,
  type TrackingType,
} from './types';

export type CreateHabitInput = {
  name: string;
  icon: string;
  categoryId: number | null;
  trackingType: TrackingType;
  targetValue?: number | null;
  targetUnit?: string | null;
  targetComparator?: TargetComparator;
  checklistItems?: string[];
  checklistSuccessMode?: 'all' | 'custom';
  checklistMinCount?: number;
  frequency: HabitFrequency;
  targetDays?: number[];
  periodTargetCount?: number | null;
  periodLengthDays?: number | null;
  /** One or more "HH:MM" (24-hour) times — a daily reminder/alarm fires at each. Empty/undefined
   * means no reminder. */
  reminderTimes?: string[];
  alarmEnabled?: boolean;
  /** Free-text grouping label, e.g. "Morning routine" — see types.ts's `routine_group` doc
   * comment. Undefined/null means ungrouped. */
  routineGroup?: string | null;
};

export type LogValues = {
  status: LogStatus;
  value?: number | null;
  checklistChecked?: number[] | null;
  note?: string | null;
  date?: string;
};

export function useHabits() {
  const db = useSQLiteContext();
  const table = useLocalTable<Habit>('habits', { where: 'archived = 0', orderBy: 'sort_order ASC, created_at ASC' });
  const [logsByHabit, setLogsByHabit] = useState<Record<number, HabitLog[]>>({});

  const refreshLogs = useCallback(async () => {
    const rows = await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs');
    const grouped: Record<number, HabitLog[]> = {};
    for (const row of rows) {
      (grouped[row.habit_id] ??= []).push(row);
    }
    setLogsByHabit(grouped);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshLogs();
    }, [refreshLogs])
  );

  // Same reasoning as db/useLocalTable.ts's onLocalWrite subscription — this hook's own
  // `logsByHabit` state (unlike `table.rows`, which useLocalTable already covers) is hand-rolled,
  // so it needs its own subscription to notice a habit_logs write made through a different
  // useHabits() instance (e.g. usePublicProfileStatsSync's, mounted once at the root layout).
  useEffect(() => {
    return onLocalWrite((table) => {
      if (table === 'habit_logs') refreshLogs();
    });
  }, [refreshLogs]);

  const upsertLog = useCallback(
    async (habitId: number, values: LogValues) => {
      const date = values.date ?? todayKey();
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
      await refreshLogs();
    },
    [db, refreshLogs]
  );

  const clearLog = useCallback(
    async (habitId: number, date?: string) => {
      const targetDate = date ?? todayKey();
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, targetDate]
      );
      if (existing) {
        await recordDeleteBeforeRemoving(db, 'habit_logs', existing.id);
      }
      await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, targetDate]);
      await refreshLogs();
    },
    [db, refreshLogs]
  );

  const toggleToday = useCallback(
    async (habit: Habit) => {
      const today = todayKey();
      const todayLog = (logsByHabit[habit.id] ?? []).find((log) => log.date === today);
      if (todayLog?.status === 'done') {
        await clearLog(habit.id, today);
      } else {
        await upsertLog(habit.id, { status: 'done' });
      }
    },
    [logsByHabit, upsertLog, clearLog]
  );

  const createHabit = useCallback(
    async (values: CreateHabitInput) => {
      const reminderTime = values.reminderTimes && values.reminderTimes.length > 0 ? JSON.stringify(values.reminderTimes) : null;
      const habitId = await table.insert({
        name: values.name,
        icon: values.icon,
        category_id: values.categoryId,
        tracking_type: values.trackingType,
        target_value: values.targetValue ?? null,
        target_unit: values.targetUnit ?? null,
        target_comparator: values.targetComparator ?? 'at_least',
        checklist_items: JSON.stringify(values.checklistItems ?? []),
        checklist_success_mode: values.checklistSuccessMode ?? 'all',
        checklist_min_count: values.checklistMinCount ?? 0,
        frequency: values.frequency,
        target_days: JSON.stringify(values.targetDays ?? []),
        period_target_count: values.periodTargetCount ?? null,
        period_length_days: values.periodLengthDays ?? null,
        reminder_time: reminderTime,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
        sort_order: table.rows.length ? Math.max(...table.rows.map((h) => h.sort_order)) + 1 : 0,
        created_at: new Date().toISOString(),
        archived: 0,
        routine_group: values.routineGroup?.trim() || null,
      } as Partial<Habit>);

      syncHabitNotifications({
        id: habitId,
        name: values.name,
        reminder_time: reminderTime,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
      }).catch(() => {});

      return habitId;
    },
    [table]
  );

  const habitsWithStats = table.rows.map((habit) => {
    const logs = logsByHabit[habit.id] ?? [];
    const targetDays = parseTargetDays(habit.target_days);
    const streak = computeStreak(
      logs.map((log) => ({ date: log.date, status: log.status })),
      habit.frequency,
      targetDays
    );
    const todayLog = logs.find((log) => log.date === todayKey());
    const periodProgress =
      habit.frequency === 'periodic' && habit.period_length_days
        ? computePeriodProgress(
            logs.filter((log) => log.status === 'done').map((log) => log.date),
            habit.period_length_days
          )
        : null;
    return { habit, streak, todayLog, periodProgress };
  });

  // Swaps sort_order with the adjacent habit in the full (unfiltered) list — reordering is always
  // relative to that global order, regardless of which category filter chip is active on screen.
  const moveHabit = useCallback(
    async (id: number, direction: 'up' | 'down') => {
      const index = table.rows.findIndex((h) => h.id === id);
      if (index === -1) return;
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= table.rows.length) return;
      const a = table.rows[index];
      const b = table.rows[swapIndex];
      const now = new Date().toISOString();
      await db.runAsync('UPDATE habits SET sort_order = ?, updated_at = ? WHERE id = ?', [b.sort_order, now, a.id]);
      await db.runAsync('UPDATE habits SET sort_order = ?, updated_at = ? WHERE id = ?', [a.sort_order, now, b.id]);
      await pushLocalRow(db, 'habits', a.id);
      await pushLocalRow(db, 'habits', b.id);
      await table.refresh();
    },
    [db, table]
  );

  const archiveHabit = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Habit>), [table]);
  const removeHabit = useCallback(
    async (id: number) => {
      // habit_logs.habit_id is ON DELETE CASCADE — tombstone those rows before table.remove()
      // deletes the habit, or other devices never learn the cascaded logs were removed too.
      const logRows = await db.getAllAsync<{ id: number }>('SELECT id FROM habit_logs WHERE habit_id = ?', [id]);
      for (const row of logRows) {
        await recordDeleteBeforeRemoving(db, 'habit_logs', row.id);
      }
      await table.remove(id);
    },
    [db, table]
  );

  return {
    habits: habitsWithStats,
    loading: table.loading,
    toggleToday,
    upsertLog,
    clearLog,
    createHabit,
    moveHabit,
    archiveHabit,
    removeHabit,
    refresh: useCallback(async () => {
      await Promise.all([table.refresh(), refreshLogs()]);
    }, [table, refreshLogs]),
  };
}
