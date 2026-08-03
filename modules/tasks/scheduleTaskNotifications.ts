import { cancelAlarm, cancelReminder, requestNotificationPermissions, scheduleOneTimeAlarm, scheduleOneTimeNotification, taskAlarmId, taskReminderId } from '@/notifications';
import type { Task } from './types';

export const REMINDER_OFFSET_OPTIONS = [0, 10, 30, 60, 1440];

export function reminderOffsetLabel(minutes: number): string {
  if (minutes === 0) return 'At due time';
  if (minutes === 1440) return '1 day before';
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`;
  return `${minutes} min before`;
}

function dueDateTime(task: Pick<Task, 'due_date' | 'due_time'>): Date | null {
  if (!task.due_date || !task.due_time) return null;
  const [year, month, day] = task.due_date.split('-').map(Number);
  const [hour, minute] = task.due_time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Reschedules (or cancels) a task's reminder/alarm notifications to match
 * its current due date/time and settings — call after every create/update
 * so the OS-level schedule never drifts from what's in SQLite.
 */
export async function syncTaskNotifications(
  task: Pick<Task, 'id' | 'title' | 'due_date' | 'due_time' | 'reminder_offset_minutes' | 'alarm_enabled'>
): Promise<void> {
  const due = dueDateTime(task);

  if (task.reminder_offset_minutes != null && due) {
    const granted = await requestNotificationPermissions();
    if (granted) {
      const reminderDate = new Date(due.getTime() - task.reminder_offset_minutes * 60_000);
      await scheduleOneTimeNotification({
        identifier: taskReminderId(task.id),
        title: task.title,
        body:
          task.reminder_offset_minutes === 0
            ? 'Due now.'
            : `Due ${reminderOffsetLabel(task.reminder_offset_minutes).replace(' before', '')} from now.`,
        date: reminderDate,
      });
    }
  } else {
    await cancelReminder(taskReminderId(task.id));
  }

  if (task.alarm_enabled && due) {
    const granted = await requestNotificationPermissions();
    if (granted) {
      const identifier = taskAlarmId(task.id);
      const title = `⏰ ${task.title}`;
      const body = 'This task is due now.';
      // Clears out anything scheduled at this ID by the old plain-notification alarm path.
      await cancelReminder(identifier);
      await scheduleOneTimeAlarm({ identifier, title, body, date: due, data: { kind: 'alarm', identifier, title, body } });
    }
  } else {
    await cancelReminder(taskAlarmId(task.id));
    await cancelAlarm(taskAlarmId(task.id));
  }
}

export async function cancelTaskNotifications(taskId: number): Promise<void> {
  await cancelReminder(taskReminderId(taskId));
  await cancelReminder(taskAlarmId(taskId));
  await cancelAlarm(taskAlarmId(taskId));
}
