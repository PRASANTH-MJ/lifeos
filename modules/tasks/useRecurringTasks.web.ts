import { useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';

import { todayKey } from '@/lib/date';
import { computePeriodProgress, isDue } from '@/modules/habits';
import { webDb } from '@/db/webDb';
import { useLocalTable } from '@/db/useLocalTable.web';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
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

/**
 * Web build of useRecurringTasks.ts — same exported shape. Reactive via Dexie's useLiveQuery for
 * both the recurring-tasks list and the task_completions rows, so a write in any tab (including
 * one applied by syncEngine.web.ts's merge) flows into every mounted instance automatically; the
 * native version's useFocusEffect-driven refreshCompletions() has no equivalent here.
 */
export function useRecurringTasks() {
  const table = useLocalTable<Task>('tasks', {
    filter: (row) => row.archived === 0 && row.is_recurring === 1,
    sort: (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  });

  const completionRows = useLiveQuery(() => webDb.task_completions.toArray() as unknown as Promise<TaskCompletion[]>, []);

  const completionsByTask: Record<number, TaskCompletion[]> = {};
  for (const row of completionRows ?? []) {
    (completionsByTask[row.task_id] ??= []).push(row);
  }

  const upsertCompletion = useCallback(async (taskId: number, values: LogValues) => {
    const date = values.date ?? todayKey();
    const existing = await webDb.task_completions
      .where('[task_id+date]')
      .equals([taskId, date])
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await webDb.task_completions.update(existing.id as number, {
        status: values.status,
        completed_at: now,
        updated_at: now,
      });
      await pushLocalRow('task_completions', existing.id as number);
    } else {
      const id = await webDb.task_completions.add({
        task_id: taskId,
        date,
        status: values.status,
        completed_at: now,
        sync_id: Crypto.randomUUID(),
        updated_at: now,
      } as never);
      await pushLocalRow('task_completions', id as number);
    }
  }, []);

  const clearCompletion = useCallback(async (taskId: number, date?: string) => {
    const targetDate = date ?? todayKey();
    const existing = await webDb.task_completions
      .where('[task_id+date]')
      .equals([taskId, targetDate])
      .first();
    if (existing) {
      await recordDeleteBeforeRemoving('task_completions', existing.id as number);
      await webDb.task_completions.delete(existing.id as number);
    }
  }, []);

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
      const now = new Date().toISOString();
      await webDb.tasks.update(a.id, { sort_order: b.sort_order, updated_at: now });
      await webDb.tasks.update(b.id, { sort_order: a.sort_order, updated_at: now });
      await pushLocalRow('tasks', a.id);
      await pushLocalRow('tasks', b.id);
    },
    [table.rows]
  );

  const archiveRecurringTask = useCallback((id: number) => table.update(id, { archived: 1 } as Partial<Task>), [table]);
  const removeRecurringTask = useCallback((id: number) => table.remove(id), [table]);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  return {
    tasks: tasksWithToday,
    completionsByTask,
    loading: table.loading || completionRows === undefined,
    createRecurringTask,
    upsertCompletion,
    clearCompletion,
    moveRecurringTask,
    archiveRecurringTask,
    removeRecurringTask,
    refresh,
  };
}
