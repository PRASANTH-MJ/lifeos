import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useLocalTable } from '@/db';
import { todayKey } from '@/lib/date';
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
  const table = useLocalTable<Habit>('habits', { where: 'archived = 0', orderBy: 'created_at ASC' });
  const [logsByHabit, setLogsByHabit] = useState<Record<number, HabitLog[]>>({});

  const refreshLogs = useCallback(async () => {
    const rows = await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs');
    const grouped: Record<number, HabitLog[]> = {};
    for (const row of rows) {
      (grouped[row.habit_id] ??= []).push(row);
    }
    setLogsByHabit(grouped);
  }, [db]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const upsertLog = useCallback(
    async (habitId: number, values: LogValues) => {
      const date = values.date ?? todayKey();
      const checklistJson = values.checklistChecked ? JSON.stringify(values.checklistChecked) : null;
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, date]
      );
      if (existing) {
        await db.runAsync(
          'UPDATE habit_logs SET status = ?, value = ?, checklist_checked = ?, note = ?, completed_at = ? WHERE id = ?',
          [values.status, values.value ?? null, checklistJson, values.note ?? null, new Date().toISOString(), existing.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO habit_logs (habit_id, date, status, value, checklist_checked, note, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [habitId, date, values.status, values.value ?? null, checklistJson, values.note ?? null, new Date().toISOString()]
        );
      }
      await refreshLogs();
    },
    [db, refreshLogs]
  );

  const clearLog = useCallback(
    async (habitId: number, date?: string) => {
      await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?', [habitId, date ?? todayKey()]);
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
    (values: CreateHabitInput) => {
      return table.insert({
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
        created_at: new Date().toISOString(),
        archived: 0,
      } as Partial<Habit>);
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

  return {
    habits: habitsWithStats,
    loading: table.loading,
    toggleToday,
    upsertLog,
    clearLog,
    createHabit,
    refresh: useCallback(async () => {
      await Promise.all([table.refresh(), refreshLogs()]);
    }, [table, refreshLogs]),
  };
}
