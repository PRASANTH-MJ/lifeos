import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { useLocalTable } from '@/db/useLocalTable.web';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
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

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

// Mirrors the native query's `WHERE archived = 0 AND parent_task_id IS NULL AND is_recurring = 0`.
function isActiveTopLevelTask(row: Task): boolean {
  return row.archived === 0 && row.parent_task_id === null && row.is_recurring === 0;
}

// Mirrors the native query's multi-key `ORDER BY`:
// (completed_at IS NOT NULL) ASC, priority (high/medium/low) ASC, (due_date IS NULL) ASC, due_date ASC
function compareTasks(a: Task, b: Task): number {
  const aCompleted = a.completed_at !== null ? 1 : 0;
  const bCompleted = b.completed_at !== null ? 1 : 0;
  if (aCompleted !== bCompleted) return aCompleted - bCompleted;

  const aPriority = PRIORITY_RANK[a.priority];
  const bPriority = PRIORITY_RANK[b.priority];
  if (aPriority !== bPriority) return aPriority - bPriority;

  const aNoDue = a.due_date === null ? 1 : 0;
  const bNoDue = b.due_date === null ? 1 : 0;
  if (aNoDue !== bNoDue) return aNoDue - bNoDue;

  if (a.due_date === null || b.due_date === null) return 0;
  return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
}

/**
 * Web build of useTasks.ts — same exported shape. The native version's two useFocusEffect
 * refreshes (archive-sweep + subtask counts) are replaced: the archive sweep still needs an
 * explicit trigger (it's a write, not just a read), so it runs once on mount and again whenever
 * `refresh()` is called; subtask counts become a useLiveQuery derived from the full tasks table,
 * so every tab's counts update automatically the instant any tab writes a subtask, with no manual
 * refresh needed at all.
 */
export function useTasks() {
  const table = useLocalTable<Task>('tasks', {
    filter: isActiveTopLevelTask,
    sort: compareTasks,
  });

  // Archives any task that finished its 2-minute undo window since the last check — mirrors the
  // native sweepCompletedArchive, run before every refresh so the active list never shows a
  // long-completed task lingering.
  const sweepCompletedArchive = useCallback(async () => {
    const cutoff = new Date(Date.now() - COMPLETED_ARCHIVE_DELAY_MS).toISOString();
    const staleIds = await webDb.transaction('rw', webDb.tasks, async () => {
      const all = (await webDb.tasks.toArray()) as Task[];
      const stale = all.filter(
        (row) => row.archived === 0 && row.completed_at !== null && row.completed_at <= cutoff
      );
      if (stale.length === 0) return [] as number[];
      const now = new Date().toISOString();
      await Promise.all(stale.map((row) => webDb.tasks.update(row.id, { archived: 1, updated_at: now })));
      return stale.map((row) => row.id);
    });
    for (const id of staleIds) {
      await pushLocalRow('tasks', id);
    }
  }, []);

  useEffect(() => {
    sweepCompletedArchive();
    // Native re-runs this on every screen focus via useFocusEffect. There's no route-focus
    // equivalent here if this hook's owning component stays mounted across in-app navigation
    // (typical for a tab), so a short interval keeps the 2-minute undo window from lingering
    // indefinitely instead of only sweeping once at mount.
    const interval = setInterval(sweepCompletedArchive, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtaskCounts = useLiveQuery(async () => {
    const all = (await webDb.tasks.toArray()) as Task[];
    const grouped: Record<number, { total: number; done: number }> = {};
    for (const row of all) {
      if (row.parent_task_id === null || row.archived !== 0) continue;
      const bucket = grouped[row.parent_task_id] ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (row.completed_at !== null) bucket.done += 1;
      grouped[row.parent_task_id] = bucket;
    }
    return grouped;
  }, []);

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

  // Replaces `tasks.parent_task_id REFERENCES tasks(id) ON DELETE CASCADE` and
  // `task_completions.task_id REFERENCES tasks(id) ON DELETE CASCADE` (db/schema.ts) — IndexedDB
  // has no FK cascade, so deleting a parent task must explicitly find and remove its subtasks
  // (and every task's own completion rows) or they're orphaned forever.
  const removeTaskCascade = useCallback(async (id: number) => {
    const completions = (await webDb.task_completions.where('task_id').equals(id).toArray()) as { id: number }[];
    for (const completion of completions) {
      await recordDeleteBeforeRemoving('task_completions', completion.id);
      await webDb.task_completions.delete(completion.id);
    }
    await recordDeleteBeforeRemoving('tasks', id);
    await webDb.tasks.delete(id);
  }, []);

  const removeTask = useCallback(
    async (id: number) => {
      const subtasks = (await webDb.tasks.where('parent_task_id').equals(id).toArray()) as { id: number }[];
      for (const subtask of subtasks) {
        await removeTaskCascade(subtask.id);
      }
      await removeTaskCascade(id);
    },
    [removeTaskCascade]
  );

  return {
    tasks: table.rows,
    loading: table.loading,
    subtaskCounts: subtaskCounts ?? {},
    createTask,
    toggleComplete,
    archiveTask,
    removeTask,
    refresh: useCallback(async () => {
      await sweepCompletedArchive();
      await table.refresh();
    }, [sweepCompletedArchive, table]),
  };
}
