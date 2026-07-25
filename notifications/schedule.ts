import * as Notifications from 'expo-notifications';

/**
 * Scaffolded for Phase 1 but not wired to any UI toggle yet — habit reminders
 * and meditation nudges both call through here once each module grows a
 * "remind me" setting.
 */
export async function scheduleDailyReminder(options: {
  identifier: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(options.identifier).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: { title: options.title, body: options.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: options.hour,
      minute: options.minute,
      repeats: true,
    },
  });
}

export function cancelReminder(identifier: string) {
  return Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Schedules a single local notification at an exact moment — used for task
 * reminders/alarms, as opposed to `scheduleDailyReminder`'s daily repeat.
 * A past `date` is not scheduled (expo-notifications would fire it
 * immediately), matching the intuitive "don't remind me about the past".
 */
export async function scheduleOneTimeNotification(options: {
  identifier: string;
  title: string;
  body: string;
  date: Date;
}): Promise<string | null> {
  await Notifications.cancelScheduledNotificationAsync(options.identifier).catch(() => {});
  if (options.date.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: { title: options.title, body: options.body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: options.date,
    },
  });
}

export function taskReminderId(taskId: number): string {
  return `task-reminder-${taskId}`;
}

export function taskAlarmId(taskId: number): string {
  return `task-alarm-${taskId}`;
}

export function habitReminderId(habitId: number): string {
  return `habit-reminder-${habitId}`;
}

export function habitAlarmId(habitId: number): string {
  return `habit-alarm-${habitId}`;
}
