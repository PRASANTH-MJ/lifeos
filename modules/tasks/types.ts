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
  sort_order: number;
  is_recurring: number;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_days: string;
  period_target_count: number | null;
  period_length_days: number | null;
  created_at: string;
  archived: number;
};

export type TaskCompletion = {
  id: number;
  task_id: number;
  date: string;
  status: TaskLogStatus;
  completed_at: string;
};

export const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low'];

export function parseRecurrenceDays(recurrenceDays: string): number[] {
  try {
    const parsed = JSON.parse(recurrenceDays);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
