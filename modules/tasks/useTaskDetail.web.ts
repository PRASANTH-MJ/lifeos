import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { computeLongestStreak, computePeriodProgress, computeStreak } from '@/modules/habits';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import { cancelTaskNotifications, syncTaskNotifications } from './scheduleTaskNotifications';
import { parseRecurrenceDays, type Task, type TaskCompletion, type TaskLogStatus } from './types';

/**
 * Web build of useTaskDetail.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine's merge)
 * flows into every mounted useTaskDetail(taskId) instance automatically.
 */
export function useTaskDetail(taskId: number) {
  const task = useLiveQuery(() => webDb.tasks.get(taskId) as Promise<Task | undefined>, [taskId]);

  const subtasks = useLiveQuery(async () => {
    const all = (await webDb.tasks.where('parent_task_id').equals(taskId).toArray()) as Task[];
    return all
      .filter((row) => !row.archived)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  }, [taskId]);

  const completions = useLiveQuery(async () => {
    const all = (await webDb.task_completions.where('task_id').equals(taskId).toArray()) as TaskCompletion[];
    return [...all].sort((a, b) => a.date.localeCompare(b.date));
  }, [taskId]);

  const loading = task === undefined || subtasks === undefined || completions === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

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
      await webDb.tasks.update(taskId, { ...values, updated_at: new Date().toISOString() });
      await pushLocalRow('tasks', taskId);
      const updated = (await webDb.tasks.get(taskId)) as Task | undefined;
      // Best-effort — never block the save on notification scheduling.
      if (updated && !updated.completed_at) syncTaskNotifications(updated).catch(() => {});
    },
    [taskId]
  );

  const toggleComplete = useCallback(async () => {
    if (!task) return;
    const completing = !task.completed_at;
    const now = new Date().toISOString();
    await webDb.tasks.update(taskId, { completed_at: completing ? now : null, updated_at: now });
    await pushLocalRow('tasks', taskId);
    (completing ? cancelTaskNotifications(taskId) : syncTaskNotifications(task)).catch(() => {});
  }, [task, taskId]);

  const addSubtask = useCallback(
    async (title: string) => {
      const now = new Date().toISOString();
      const id = await webDb.tasks.add({
        title,
        notes: null,
        priority: task?.priority ?? 'medium',
        due_date: null,
        completed_at: null,
        parent_task_id: taskId,
        sort_order: subtasks?.length ?? 0,
        created_at: now,
        archived: 0,
        sync_id: Crypto.randomUUID(),
        updated_at: now,
      } as never);
      await pushLocalRow('tasks', id as number);
    },
    [task, taskId, subtasks]
  );

  const toggleSubtask = useCallback(async (subtask: Task) => {
    const now = new Date().toISOString();
    await webDb.tasks.update(subtask.id, { completed_at: subtask.completed_at ? null : now, updated_at: now });
    await pushLocalRow('tasks', subtask.id);
  }, []);

  const archiveTask = useCallback(async () => {
    await webDb.tasks.update(taskId, { archived: 1, updated_at: new Date().toISOString() });
    await pushLocalRow('tasks', taskId);
    cancelTaskNotifications(taskId).catch(() => {});
  }, [taskId]);

  const deleteTask = useCallback(async () => {
    await recordDeleteBeforeRemoving('tasks', taskId);
    await webDb.tasks.delete(taskId);
    cancelTaskNotifications(taskId).catch(() => {});
  }, [taskId]);

  // "Clear history" equivalent of a habit restart — wipes logged completions without deleting the task itself.
  const clearCompletionHistory = useCallback(async () => {
    const rows = (await webDb.task_completions.where('task_id').equals(taskId).toArray()) as { id: number }[];
    for (const row of rows) {
      await recordDeleteBeforeRemoving('task_completions', row.id);
    }
    await webDb.task_completions.where('task_id').equals(taskId).delete();
  }, [taskId]);

  const upsertCompletion = useCallback(
    async (date: string, status: TaskLogStatus) => {
      const existing = (await webDb.task_completions
        .where('task_id')
        .equals(taskId)
        .and((row) => (row as { date: string }).date === date)
        .first()) as { id: number } | undefined;
      const now = new Date().toISOString();
      if (existing) {
        await webDb.task_completions.update(existing.id, { status, completed_at: now, updated_at: now });
        await pushLocalRow('task_completions', existing.id);
      } else {
        const id = await webDb.task_completions.add({
          task_id: taskId,
          date,
          status,
          completed_at: now,
          sync_id: Crypto.randomUUID(),
          updated_at: now,
        } as never);
        await pushLocalRow('task_completions', id as number);
      }
    },
    [taskId]
  );

  const clearCompletion = useCallback(
    async (date: string) => {
      const existing = (await webDb.task_completions
        .where('task_id')
        .equals(taskId)
        .and((row) => (row as { date: string }).date === date)
        .first()) as { id: number } | undefined;
      if (existing) {
        await recordDeleteBeforeRemoving('task_completions', existing.id);
      }
      await webDb.task_completions
        .where('task_id')
        .equals(taskId)
        .and((row) => (row as { date: string }).date === date)
        .delete();
    },
    [taskId]
  );

  const completionRows = completions ?? [];
  const subtaskRows = subtasks ?? [];

  const heatmapValues = Object.fromEntries(completionRows.filter((c) => c.status === 'done').map((c) => [c.date, 1]));
  const periodProgress =
    task && task.recurrence_frequency === 'periodic' && task.period_length_days
      ? computePeriodProgress(
          completionRows.filter((c) => c.status === 'done').map((c) => c.date),
          task.period_length_days
        )
      : null;

  const recurrenceDays = task ? parseRecurrenceDays(task.recurrence_days) : [];
  const streak =
    task && task.is_recurring ? computeStreak(completionRows, task.recurrence_frequency ?? 'daily', recurrenceDays) : 0;
  const longestStreak =
    task && task.is_recurring
      ? computeLongestStreak(completionRows, task.recurrence_frequency ?? 'daily', recurrenceDays)
      : 0;

  return {
    task: task ?? null,
    subtasks: subtaskRows,
    completions: completionRows,
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
