import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useLocalTable } from '@/db';
import { cancelTaskNotifications, syncTaskNotifications } from './scheduleTaskNotifications';
import type { Task, TaskPriority } from './types';

export type CreateTaskInput = {
  title: string;
  notes?: string;
  priority: TaskPriority;
  categoryId?: number | null;
  important?: boolean;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderOffsetMinutes?: number | null;
  alarmEnabled?: boolean;
};

/** How long a completed task stays visible (checked off, sorted to the bottom) before it's
 * auto-archived out of the active list — a brief undo window rather than an instant vanish. */
const COMPLETED_ARCHIVE_DELAY_MS = 2 * 60 * 1000;

export function useTasks() {
  const db = useSQLiteContext();
  const table = useLocalTable<Task>('tasks', {
    where: 'archived = 0 AND parent_task_id IS NULL AND is_recurring = 0',
    orderBy:
      "(completed_at IS NOT NULL) ASC, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC, (due_date IS NULL) ASC, due_date ASC",
  });
  const [subtaskCounts, setSubtaskCounts] = useState<Record<number, { total: number; done: number }>>({});

  // Archives any task that finished its 2-minute undo window since the last check — run before
  // every refresh so the active list never shows a long-completed task lingering.
  const sweepCompletedArchive = useCallback(async () => {
    const cutoff = new Date(Date.now() - COMPLETED_ARCHIVE_DELAY_MS).toISOString();
    await db.runAsync('UPDATE tasks SET archived = 1 WHERE archived = 0 AND completed_at IS NOT NULL AND completed_at <= ?', [cutoff]);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      sweepCompletedArchive().then(() => table.refresh());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sweepCompletedArchive])
  );

  const refreshSubtaskCounts = useCallback(async () => {
    const rows = await db.getAllAsync<{ parent_task_id: number; total: number; done: number }>(
      `SELECT parent_task_id, COUNT(*) as total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as done
       FROM tasks WHERE parent_task_id IS NOT NULL AND archived = 0 GROUP BY parent_task_id`
    );
    const grouped: Record<number, { total: number; done: number }> = {};
    for (const row of rows) {
      grouped[row.parent_task_id] = { total: row.total, done: row.done };
    }
    setSubtaskCounts(grouped);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshSubtaskCounts();
    }, [refreshSubtaskCounts])
  );

  const createTask = useCallback(
    async (values: CreateTaskInput) => {
      const taskId = await table.insert({
        title: values.title,
        notes: values.notes ?? null,
        priority: values.priority,
        category_id: values.categoryId ?? null,
        important: values.important ? 1 : 0,
        due_date: values.dueDate ?? null,
        due_time: values.dueTime ?? null,
        reminder_offset_minutes: values.reminderOffsetMinutes ?? null,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
        completed_at: null,
        parent_task_id: null,
        sort_order: 0,
        is_recurring: 0,
        recurrence_frequency: null,
        recurrence_days: '[]',
        created_at: new Date().toISOString(),
        archived: 0,
      } as Partial<Task>);

      // Best-effort side effect — scheduling can involve a slow/hanging OS
      // permission prompt, and must never block or fail the task save itself.
      syncTaskNotifications({
        id: taskId,
        title: values.title,
        due_date: values.dueDate ?? null,
        due_time: values.dueTime ?? null,
        reminder_offset_minutes: values.reminderOffsetMinutes ?? null,
        alarm_enabled: values.alarmEnabled ? 1 : 0,
      }).catch(() => {});

      return taskId;
    },
    [table]
  );

  const toggleComplete = useCallback(
    async (task: Task) => {
      const completing = !task.completed_at;
      await table.update(task.id, { completed_at: completing ? new Date().toISOString() : null } as Partial<Task>);
      // A completed task doesn't need its due-time reminder/alarm firing anymore.
      // Best-effort — never block the toggle on notification scheduling.
      (completing ? cancelTaskNotifications(task.id) : syncTaskNotifications(task)).catch(() => {});
    },
    [table]
  );

  const archiveTask = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Task>), [table]);
  const removeTask = useCallback((id: number) => table.remove(id), [table]);

  return {
    tasks: table.rows,
    loading: table.loading,
    subtaskCounts,
    createTask,
    toggleComplete,
    archiveTask,
    removeTask,
    refresh: useCallback(async () => {
      await sweepCompletedArchive();
      await Promise.all([table.refresh(), refreshSubtaskCounts()]);
    }, [sweepCompletedArchive, table, refreshSubtaskCounts]),
  };
}
