import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { useLocalTable } from '@/db/useLocalTable.web';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
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

/** Mirrors habits/habit_logs' CHECK constraints (db/schema.ts) — SQLite would reject a
 * violating insert/update; IndexedDB has no such guard, and bad values here would corrupt
 * computeStreak/computePeriodProgress's input. */
export const VALID_LOG_STATUSES: LogStatus[] = ['done', 'fail', 'skip'];
export const VALID_TRACKING_TYPES: TrackingType[] = ['yesno', 'numeric', 'timer', 'checklist'];
export const VALID_TARGET_COMPARATORS: TargetComparator[] = ['at_least', 'at_most', 'exactly'];
export const VALID_CHECKLIST_MODES = ['all', 'custom'] as const;
export const VALID_FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'monthly', 'periodic'];

export function assertValidLogStatus(status: LogStatus): void {
  if (!VALID_LOG_STATUSES.includes(status)) throw new Error(`Invalid habit log status "${status}"`);
}

export function assertValidHabitShape(values: {
  trackingType: TrackingType;
  targetComparator: TargetComparator;
  checklistSuccessMode: string;
  frequency: HabitFrequency;
}): void {
  if (!VALID_TRACKING_TYPES.includes(values.trackingType)) throw new Error(`Invalid tracking_type "${values.trackingType}"`);
  if (!VALID_TARGET_COMPARATORS.includes(values.targetComparator)) throw new Error(`Invalid target_comparator "${values.targetComparator}"`);
  if (!VALID_CHECKLIST_MODES.includes(values.checklistSuccessMode as never)) {
    throw new Error(`Invalid checklist_success_mode "${values.checklistSuccessMode}"`);
  }
  if (!VALID_FREQUENCIES.includes(values.frequency)) throw new Error(`Invalid frequency "${values.frequency}"`);
}

/**
 * Web build of useHabits.ts — same exported shape. Reactive via Dexie's useLiveQuery instead of
 * expo-router's useFocusEffect: a write to `habits` or `habit_logs` from any tab (or the sync
 * engine's merge) flows into every mounted useHabits() instance automatically, so the native
 * file's manual refreshLogs()-on-focus pattern isn't needed here.
 */
export function useHabits() {
  const table = useLocalTable<Habit>('habits', {
    filter: (h) => h.archived === 0,
    sort: (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  });

  const logsByHabit = useLiveQuery(async () => {
    const rows = (await webDb.habit_logs.toArray()) as HabitLog[];
    const grouped: Record<number, HabitLog[]> = {};
    for (const row of rows) {
      (grouped[row.habit_id] ??= []).push(row);
    }
    return grouped;
  }, []) ?? {};

  const upsertLog = useCallback(async (habitId: number, values: LogValues) => {
    assertValidLogStatus(values.status);
    const date = values.date ?? todayKey();
    const checklistJson = values.checklistChecked ? JSON.stringify(values.checklistChecked) : null;
    const existing = await webDb.habit_logs.where({ habit_id: habitId, date }).first() as (HabitLog & { id: number }) | undefined;
    const now = new Date().toISOString();
    if (existing) {
      await webDb.habit_logs.update(existing.id, {
        status: values.status,
        value: values.value ?? null,
        checklist_checked: checklistJson,
        note: values.note ?? null,
        completed_at: now,
        updated_at: now,
      });
      await pushLocalRow('habit_logs', existing.id);
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
  }, []);

  const clearLog = useCallback(async (habitId: number, date?: string) => {
    const targetDate = date ?? todayKey();
    const existing = await webDb.habit_logs.where({ habit_id: habitId, date: targetDate }).first() as { id: number } | undefined;
    if (existing) {
      await recordDeleteBeforeRemoving('habit_logs', existing.id);
      await webDb.habit_logs.delete(existing.id);
    }
  }, []);

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
      assertValidHabitShape({
        trackingType: values.trackingType,
        targetComparator: values.targetComparator ?? 'at_least',
        checklistSuccessMode: values.checklistSuccessMode ?? 'all',
        frequency: values.frequency,
      });
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
      await webDb.habits.update(a.id, { sort_order: b.sort_order, updated_at: now });
      await webDb.habits.update(b.id, { sort_order: a.sort_order, updated_at: now });
      await pushLocalRow('habits', a.id);
      await pushLocalRow('habits', b.id);
    },
    [table]
  );

  const archiveHabit = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Habit>), [table]);
  const removeHabit = useCallback((id: number) => table.remove(id), [table]);

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
      // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
    }, []),
  };
}
