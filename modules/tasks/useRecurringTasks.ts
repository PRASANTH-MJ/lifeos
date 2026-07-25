import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { todayKey } from '@/lib/date';
import { computePeriodProgress, isDue } from '@/modules/habits';
import { useLocalTable } from '@/db';
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
      if (existing) {
        await db.runAsync('UPDATE task_completions SET status = ?, completed_at = ? WHERE id = ?', [
          values.status,
          new Date().toISOString(),
          existing.id,
        ]);
      } else {
        await db.runAsync('INSERT INTO task_completions (task_id, date, status, completed_at) VALUES (?, ?, ?, ?)', [
          taskId,
          date,
          values.status,
          new Date().toISOString(),
        ]);
      }
      await refreshCompletions();
    },
    [db, refreshCompletions]
  );

  const clearCompletion = useCallback(
    async (taskId: number, date?: string) => {
      await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', [taskId, date ?? todayKey()]);
      await refreshCompletions();
    },
    [db, refreshCompletions]
  );

  const createRecurringTask = useCallback(
    (values: CreateRecurringTaskInput) => {
      return table.insert({
        title: values.title,
        notes: values.notes ?? null,
        priority: values.priority,
        category_id: values.categoryId ?? null,
        important: values.important ? 1 : 0,
        due_date: null,
        due_time: null,
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
      await db.runAsync('UPDATE tasks SET sort_order = ? WHERE id = ?', [b.sort_order, a.id]);
      await db.runAsync('UPDATE tasks SET sort_order = ? WHERE id = ?', [a.sort_order, b.id]);
      await table.refresh();
    },
    [db, table]
  );

  const archiveRecurringTask = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Task>), [table]);
  const removeRecurringTask = useCallback((id: number) => table.remove(id), [table]);

  return {
    tasks: tasksWithToday,
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
