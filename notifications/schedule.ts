import * as Notifications from 'expo-notifications';

/**
 * Repeats once per day at the given time. Deliberately uses the `DAILY` trigger, not `CALENDAR`
 * (which expo-notifications documents as iOS-only) — `CALENDAR` silently never fires on Android,
 * which was a real bug here: every daily reminder (Habits, and all seven module reminders in
 * their default "every day" schedule) was Android-dead until this was caught.
 */
export async function scheduleDailyReminder(options: {
  identifier: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
  sound?: boolean;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(options.identifier).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: { title: options.title, body: options.body, sound: options.sound ?? false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: 'default',
      hour: options.hour,
      minute: options.minute,
    },
  });
}

/** Never throws — expo-notifications has no scheduling support on web at all, so cancelling an
 * identifier that (from the web runtime's perspective) was never actually schedulable would
 * otherwise crash every call site on web for what's a complete no-op there anyway. */
export function cancelReminder(identifier: string) {
  return Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}

/**
 * Schedules a notification that repeats every week on one weekday — used for a "specific days
 * of the week" reminder schedule, where `scheduleDailyReminder`'s every-day repeat doesn't fit.
 * `weekday` is 1–7 with 1 = Sunday, matching expo-notifications' own convention.
 */
export async function scheduleWeeklyReminder(options: {
  identifier: string;
  title: string;
  body: string;
  weekday: number;
  hour: number;
  minute: number;
  sound?: boolean;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(options.identifier).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: { title: options.title, body: options.body, sound: options.sound ?? false },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      channelId: 'default',
      weekday: options.weekday,
      hour: options.hour,
      minute: options.minute,
    },
  });
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
      channelId: 'default',
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

/** `id` is a module_reminders row id — a module can have several reminders, each scheduling
 * independently under its own identifier. */
export function moduleReminderId(moduleKey: string, id: number): string {
  return `module-reminder-${moduleKey}-${id}`;
}
