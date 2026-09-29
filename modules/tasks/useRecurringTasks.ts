import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { todayKey } from '@/lib/date';
import { computePeriodProgress, isDue } from '@/modules/habits';
import { useLocalTable } from '@/db';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import { syncTaskNotifications } from './scheduleTaskNotifications';
import { parseRecurrenceDays, type RecurrenceFrequency, type Task, type TaskCompletion, type TaskLogStatus, type TaskPriority } from './types';

export type CreateRecurringTaskInput = {
  title: string;
  notes?: string;
  priority: TaskPriority;
  categoryId?: number | null;
  important?: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceDays?: number[];
  periodTargetCount?: number | null;
  periodLengthDays?: number | null;
  /** Time of day ("HH:MM") to remind/alarm at each time this task recurs — see
   * scheduleTaskNotifications.ts's syncRecurringTaskNotifications for how this differs from a
   * one-off task's actual due time. */
  dueTime?: string | null;
  reminderOffsetMinutes?: number | null;
  alarmEnabled?: boolean;
};

export type LogValues = {
  status: TaskLogStatus;
  date?: string;
};

export function useRecurringTasks() {
  const db = useSQLiteContext();
  const table = useLocalTable<Task>('tasks', { where: 'archived = 0 AND is_recurring = 1', orderBy: 'sort_order ASC, created_at ASC' });
  const [completionsByTask, setCompletionsByTask] = useState<Record<number, TaskCompletion[]>>({});

  const refreshCompletions = useCallback(async () => {
    const rows = await db.getAllAsync<TaskCompletion>('SELECT * FROM task_completions');
    const grouped: Record<number, TaskCompletion[]> = {};
    for (const row of rows) {
      (grouped[row.task_id] ??= []).push(row);
    }
    setCompletionsByTask(grouped);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshCompletions();
    }, [refreshCompletions])
  );

  const upsertCompletion = useCallback(
    async (taskId: number, values: LogValues) => {
      const date = values.date ?? todayKey();
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM task_completions WHERE task_id = ? AND date = ?',
        [taskId, date]
      );
      const now = new Date().toISOString();
      if (existing) {
        await db.runAsync('UPDATE task_completions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [
          values.status,
          now,
          now,
          existing.id,
        ]);
        await pushLocalRow(db, 'task_completions', existing.id);
      } else {
        const result = await db.runAsync(
          'INSERT INTO task_completions (task_id, date, status, completed_at, sync_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [taskId, date, values.status, now, Crypto.randomUUID(), now]
        );
        await pushLocalRow(db, 'task_completions', result.lastInsertRowId);
      }
      await refreshCompletions();
    },
    [db, refreshCompletions]
  );

  const clearCompletion = useCallback(
    async (taskId: number, date?: string) => {
      const targetDate = date ?? todayKey();
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM task_completions WHERE task_id = ? AND date = ?',
        [taskId, targetDate]
      );
      if (existing) {
        await recordDeleteBeforeRemoving(db, 'task_completions', existing.id);
      }
      await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', [taskId, targetDate]);
      await refreshCompletions();
    },
    [db, refreshCompletions]
  );

  const createRecurringTask = useCallback(
    async (values: CreateRecurringTaskInput) => {
      const taskId = await table.insert({
        title: values.title,
        notes: values.notes ?? null,
        priority: values.priority,
        category_id: values.categoryId ?? null,
        important: values.important ? 1 : 0,
        due_date: null,
        due_time: values.dueTime ?? null,
        reminder_offset_minutes: values.reminderOffsetMinutes ?? null,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
        completed_at: null,
        parent_task_id: null,
        sort_order: table.rows.length ? Math.max(...table.rows.map((t) => t.sort_order)) + 1 : 0,
        is_recurring: 1,
        recurrence_frequency: values.recurrenceFrequency,
        recurrence_days: JSON.stringify(values.recurrenceDays ?? []),
        period_target_count: values.periodTargetCount ?? null,
        period_length_days: values.periodLengthDays ?? null,
        created_at: new Date().toISOString(),
        archived: 0,
      } as Partial<Task>);

      // Best-effort — scheduling can involve a slow/hanging OS permission prompt, and must never
      // block or fail the task save itself (same reasoning as useTasks.ts's createTask).
      syncTaskNotifications({
        id: taskId,
        title: values.title,
        due_date: null,
        due_time: values.dueTime ?? null,
        reminder_offset_minutes: values.reminderOffsetMinutes ?? null,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
        is_recurring: 1,
        recurrence_frequency: values.recurrenceFrequency,
        recurrence_days: JSON.stringify(values.recurrenceDays ?? []),
      }).catch(() => {});

      return taskId;
    },
    [table]
  );

  const tasksWithToday = table.rows.map((task) => {
    const completions = completionsByTask[task.id] ?? [];
    const todayLog = completions.find((c) => c.date === todayKey());
    const due = task.recurrence_frequency
      ? isDue(todayKey(), task.recurrence_frequency, parseRecurrenceDays(task.recurrence_days))
      : true;
    const periodProgress =
      task.recurrence_frequency === 'periodic' && task.period_length_days
        ? computePeriodProgress(
            completions.filter((c) => c.status === 'done').map((c) => c.date),
            task.period_length_days
          )
        : null;
    return { task, todayLog, due, periodProgress };
  });

  const moveRecurringTask = useCallback(
    async (id: number, direction: 'up' | 'down') => {
      const index = table.rows.findIndex((t) => t.id === id);
      if (index === -1) return;
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= table.rows.length) return;
      const a = table.rows[index];
      const b = table.rows[swapIndex];
      const now = new Date().toISOString();
      await db.runAsync('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [b.sort_order, now, a.id]);
      await db.runAsync('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?', [a.sort_order, now, b.id]);
      await pushLocalRow(db, 'tasks', a.id);
      await pushLocalRow(db, 'tasks', b.id);
      await table.refresh();
    },
    [db, table]
  );

  const archiveRecurringTask = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Task>), [table]);
  const removeRecurringTask = useCallback(
    async (id: number) => {
      // task_completions.task_id and tasks.parent_task_id are both ON DELETE CASCADE — tombstone
      // completions and any subtasks before table.remove() deletes the task, or other devices
      // never learn the cascaded rows were removed too.
      const subtasks = await db.getAllAsync<{ id: number }>('SELECT id FROM tasks WHERE parent_task_id = ?', [id]);
      for (const taskId of [id, ...subtasks.map((t) => t.id)]) {
        const completions = await db.getAllAsync<{ id: number }>('SELECT id FROM task_completions WHERE task_id = ?', [taskId]);
        for (const row of completions) {
          await recordDeleteBeforeRemoving(db, 'task_completions', row.id);
        }
      }
      for (const subtask of subtasks) {
        await recordDeleteBeforeRemoving(db, 'tasks', subtask.id);
      }
      await table.remove(id);
    },
    [db, table]
  );

  return {
    tasks: tasksWithToday,
    // Raw per-task completion history, keyed by task id — exposed alongside `tasks`'s per-task
    // summary (today's log, due-ness, period progress) for callers that need the full history to
    // compute their own streak-like aggregates.
    completionsByTask,
    loading: table.loading,
    createRecurringTask,
    upsertCompletion,
    clearCompletion,
    moveRecurringTask,
    archiveRecurringTask,
    removeRecurringTask,
    refresh: useCallback(async () => {
      await Promise.all([table.refresh(), refreshCompletions()]);
    }, [table, refreshCompletions]),
  };
}
