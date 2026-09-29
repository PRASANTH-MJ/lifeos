import {
  cancelAlarm,
  cancelReminder,
  requestNotificationPermissions,
  scheduleDailyAlarm,
  scheduleDailyReminder,
  scheduleOneTimeAlarm,
  scheduleOneTimeNotification,
  scheduleWeeklyAlarm,
  scheduleWeeklyReminder,
  taskAlarmId,
  taskReminderId,
} from '@/notifications';
import { parseRecurrenceDays, type Task } from './types';

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

/** Every identifier a recurring task's reminder/alarm could be scheduled under — the base id
 * (used for a 'daily' recurrence) plus one per weekday (used for weekly/monthly/periodic
 * recurrences with specific days) — cancelled unconditionally before rescheduling so switching
 * recurrence type/days never leaves a stale weekday notification behind. Mirrors
 * modules/reminders/useModuleReminder.ts's identical allReminderIds pattern. */
function allWeekdayVariants(baseId: string): string[] {
  return [baseId, ...Array.from({ length: 7 }, (_, day) => `${baseId}-${day}`)];
}

/**
 * Reschedules (or cancels) a task's reminder/alarm notifications to match its current settings —
 * call after every create/update so the OS-level schedule never drifts from what's in SQLite.
 *
 * One-off tasks (is_recurring = 0) use `due_date` + `due_time` for a single exact-moment
 * notification (optionally offset earlier via `reminder_offset_minutes`), same as before.
 *
 * Recurring tasks have no single due date to offset from, so `due_time` is instead treated as "the
 * time of day to remind at" and `reminder_offset_minutes` just toggles the plain notification on/off
 * (its actual minute value is irrelevant for a recurring task) — a 'daily' recurrence repeats every
 * day at that time; 'weekly'/'monthly'/'periodic' repeat on each day in `recurrence_days` (0=Sun..6=Sat,
 * converted to expo-notifications' 1=Sun..7=Sat convention).
 */
export async function syncTaskNotifications(
  task: Pick<
    Task,
    'id' | 'title' | 'due_date' | 'due_time' | 'reminder_offset_minutes' | 'alarm_enabled' | 'is_recurring' | 'recurrence_frequency' | 'recurrence_days'
  >
): Promise<void> {
  if (task.is_recurring) {
    await syncRecurringTaskNotifications(task);
    return;
  }

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

async function syncRecurringTaskNotifications(
  task: Pick<Task, 'id' | 'title' | 'due_time' | 'reminder_offset_minutes' | 'alarm_enabled' | 'recurrence_frequency' | 'recurrence_days'>
): Promise<void> {
  const reminderBaseId = taskReminderId(task.id);
  const alarmBaseId = taskAlarmId(task.id);
  // Both notification systems share this identifier space — clear both regardless of which one a
  // previous save used, so switching recurrence/time/type never leaves a stale reminder or alarm
  // behind (same reasoning as useModuleReminder.ts's applySchedule).
  await Promise.all(
    [...allWeekdayVariants(reminderBaseId), ...allWeekdayVariants(alarmBaseId)].flatMap((id) => [cancelReminder(id), cancelAlarm(id)])
  );

  if (!task.due_time) return;
  const [hour, minute] = task.due_time.split(':').map(Number);
  const daily = task.recurrence_frequency === 'daily';
  // Task recurrence_days is 0=Sun..6=Sat (see WEEKDAY_LABELS); expo-notifications' weekday
  // trigger is 1=Sun..7=Sat — +1 converts one convention to the other.
  const weekdays = daily ? [] : parseRecurrenceDays(task.recurrence_days).map((day) => day + 1);

  const wantsReminder = task.reminder_offset_minutes != null;
  const wantsAlarm = task.alarm_enabled;
  if (!wantsReminder && !wantsAlarm) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  if (wantsReminder) {
    const body = 'This recurring task is due now.';
    if (daily) {
      await scheduleDailyReminder({ identifier: reminderBaseId, title: task.title, body, hour, minute });
    } else {
      for (const weekday of weekdays) {
        await scheduleWeeklyReminder({ identifier: `${reminderBaseId}-${weekday - 1}`, title: task.title, body, weekday, hour, minute });
      }
    }
  }

  if (wantsAlarm) {
    const alarmTitle = `⏰ ${task.title}`;
    const body = 'This recurring task is due now.';
    if (daily) {
      await scheduleDailyAlarm({ identifier: alarmBaseId, title: alarmTitle, body, hour, minute, data: { kind: 'alarm', identifier: alarmBaseId, title: alarmTitle, body } });
    } else {
      for (const weekday of weekdays) {
        const weekdayId = `${alarmBaseId}-${weekday - 1}`;
        await scheduleWeeklyAlarm({ identifier: weekdayId, title: alarmTitle, body, weekday, hour, minute, data: { kind: 'alarm', identifier: weekdayId, title: alarmTitle, body } });
      }
    }
  }
}

export async function cancelTaskNotifications(taskId: number): Promise<void> {
  const reminderBaseId = taskReminderId(taskId);
  const alarmBaseId = taskAlarmId(taskId);
  await Promise.all(
    [...allWeekdayVariants(reminderBaseId), ...allWeekdayVariants(alarmBaseId)].flatMap((id) => [cancelReminder(id), cancelAlarm(id)])
  );
}
