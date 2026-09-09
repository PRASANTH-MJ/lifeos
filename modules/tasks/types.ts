export type TaskPriority = 'low' | 'medium' | 'high';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'periodic';
export type TaskLogStatus = 'done' | 'fail' | 'skip';

export type Task = {
  id: number;
  title: string;
  notes: string | null;
  priority: TaskPriority;
  category_id: number | null;
  important: number;
  due_date: string | null;
  due_time: string | null;
  reminder_offset_minutes: number | null;
  alarm_enabled: number;
  completed_at: string | null;
  parent_task_id: number | null;
  blocked_by_task_id: number | null;
  sort_order: number;
  is_recurring: number;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_days: string;
  period_target_count: number | null;
  period_length_days: number | null;
  created_at: string;
  archived: number;
};

export type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

export type TaskCompletion = {
  id: number;
  task_id: number;
  date: string;
  status: TaskLogStatus;
  completed_at: string;
};

export const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low'];

/** True when `task` names a blocking task that isn't done yet — the one condition that disables
 * its "mark complete" action everywhere (task list, task detail, log sheet). Once the blocking
 * task is completed (or unset), this goes false and completing normally resumes. */
export function isBlockedByIncompleteTask(task: Pick<Task, 'blocked_by_task_id'>, blockingTask: Pick<Task, 'completed_at'> | null | undefined): boolean {
  return Boolean(task.blocked_by_task_id) && Boolean(blockingTask) && !blockingTask!.completed_at;
}

export function parseRecurrenceDays(recurrenceDays: string): number[] {
  try {
    const parsed = JSON.parse(recurrenceDays);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
