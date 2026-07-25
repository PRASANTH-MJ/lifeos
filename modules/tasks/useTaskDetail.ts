import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { computeLongestStreak, computePeriodProgress, computeStreak } from '@/modules/habits';
import { cancelTaskNotifications, syncTaskNotifications } from './scheduleTaskNotifications';
import { parseRecurrenceDays, type Task, type TaskCompletion, type TaskLogStatus } from './types';

export function useTaskDetail(taskId: number) {
  const db = useSQLiteContext();
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [taskRow, subtaskRows, completionRows] = await Promise.all([
      db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]),
      db.getAllAsync<Task>(
        'SELECT * FROM tasks WHERE parent_task_id = ? AND archived = 0 ORDER BY sort_order ASC, created_at ASC',
        [taskId]
      ),
      db.getAllAsync<TaskCompletion>('SELECT * FROM task_completions WHERE task_id = ? ORDER BY date ASC', [taskId]),
    ]);
    setTask(taskRow);
    setSubtasks(subtaskRows);
    setCompletions(completionRows);
    setLoading(false);
  }, [db, taskId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const updateTask = useCallback(
    async (
      values: Partial<
        Pick<
          Task,
          | 'title'
          | 'notes'
          | 'priority'
          | 'due_date'
          | 'due_time'
          | 'category_id'
          | 'important'
          | 'recurrence_frequency'
          | 'recurrence_days'
          | 'period_target_count'
          | 'period_length_days'
          | 'reminder_offset_minutes'
          | 'alarm_enabled'
        >
      >
    ) => {
      const keys = Object.keys(values) as (keyof typeof values)[];
      const setClause = keys.map((key) => `${key} = ?`).join(', ');
      await db.runAsync(`UPDATE tasks SET ${setClause} WHERE id = ?`, [
        ...keys.map((key) => values[key] as string | number | null),
        taskId,
      ]);
      const updated = await db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
      // Best-effort — never block the save on notification scheduling.
      if (updated && !updated.completed_at) syncTaskNotifications(updated).catch(() => {});
      await refresh();
    },
    [db, taskId, refresh]
  );

  const toggleComplete = useCallback(async () => {
    if (!task) return;
    const completing = !task.completed_at;
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id = ?', [
      completing ? new Date().toISOString() : null,
      taskId,
    ]);
    (completing ? cancelTaskNotifications(taskId) : syncTaskNotifications(task)).catch(() => {});
    await refresh();
  }, [db, task, taskId, refresh]);

  const addSubtask = useCallback(
    async (title: string) => {
      await db.runAsync(
        `INSERT INTO tasks (title, notes, priority, due_date, completed_at, parent_task_id, sort_order, created_at, archived)
         VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, 0)`,
        [title, task?.priority ?? 'medium', taskId, subtasks.length, new Date().toISOString()]
      );
      await refresh();
    },
    [db, task, taskId, subtasks.length, refresh]
  );

  const toggleSubtask = useCallback(
    async (subtask: Task) => {
      await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id = ?', [
        subtask.completed_at ? null : new Date().toISOString(),
        subtask.id,
      ]);
      await refresh();
    },
    [db, refresh]
  );

  const archiveTask = useCallback(async () => {
    await db.runAsync('UPDATE tasks SET archived = 1 WHERE id = ?', [taskId]);
    cancelTaskNotifications(taskId).catch(() => {});
  }, [db, taskId]);

  const deleteTask = useCallback(async () => {
    await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);
    cancelTaskNotifications(taskId).catch(() => {});
  }, [db, taskId]);

  // "Clear history" equivalent of a habit restart — wipes logged completions without deleting the task itself.
  const clearCompletionHistory = useCallback(async () => {
    await db.runAsync('DELETE FROM task_completions WHERE task_id = ?', [taskId]);
    await refresh();
  }, [db, taskId, refresh]);

  const upsertCompletion = useCallback(
    async (date: string, status: TaskLogStatus) => {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM task_completions WHERE task_id = ? AND date = ?', [taskId, date]);
      if (existing) {
        await db.runAsync('UPDATE task_completions SET status = ?, completed_at = ? WHERE id = ?', [status, new Date().toISOString(), existing.id]);
      } else {
        await db.runAsync('INSERT INTO task_completions (task_id, date, status, completed_at) VALUES (?, ?, ?, ?)', [
          taskId,
          date,
          status,
          new Date().toISOString(),
        ]);
      }
      await refresh();
    },
    [db, taskId, refresh]
  );

  const clearCompletion = useCallback(
    async (date: string) => {
      await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', [taskId, date]);
      await refresh();
    },
    [db, taskId, refresh]
  );

  const heatmapValues = Object.fromEntries(completions.filter((c) => c.status === 'done').map((c) => [c.date, 1]));
  const periodProgress =
    task && task.recurrence_frequency === 'periodic' && task.period_length_days
      ? computePeriodProgress(
          completions.filter((c) => c.status === 'done').map((c) => c.date),
          task.period_length_days
        )
      : null;

  const recurrenceDays = task ? parseRecurrenceDays(task.recurrence_days) : [];
  const streak =
    task && task.is_recurring ? computeStreak(completions, task.recurrence_frequency ?? 'daily', recurrenceDays) : 0;
  const longestStreak =
    task && task.is_recurring ? computeLongestStreak(completions, task.recurrence_frequency ?? 'daily', recurrenceDays) : 0;

  return {
    task,
    subtasks,
    completions,
    heatmapValues,
    periodProgress,
    streak,
    longestStreak,
    loading,
    updateTask,
    toggleComplete,
    addSubtask,
    toggleSubtask,
    archiveTask,
    deleteTask,
    clearCompletionHistory,
    upsertCompletion,
    clearCompletion,
    refresh,
  };
}
