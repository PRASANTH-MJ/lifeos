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
  /** Picked up by app/_layout.tsx's useNotificationResponseRouting — set `{ route: '/some-path' }`
   * to deep-link a tap on this reminder straight to a screen, same as a remote push's route. */
  data?: Record<string, unknown>;
}): Promise<string> {
  await Notifications.cancelScheduledNotificationAsync(options.identifier).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: { title: options.title, body: options.body, sound: options.sound ?? false, data: options.data },
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

/**
 * Fires right away (trigger: null), unlike scheduleOneTimeNotification which deliberately refuses
 * anything not strictly in the future — used for reacting to an event that already happened
 * rather than reminding about a future one.
 */
export function presentImmediateNotification(options: { title: string; body: string }): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: options.title, body: options.body, sound: true },
    trigger: null,
  });
}

export function taskReminderId(taskId: number): string {
  return `task-reminder-${taskId}`;
}

export function taskAlarmId(taskId: number): string {
  return `task-alarm-${taskId}`;
}

/** `index` (0-based) distinguishes a habit's several reminder times (e.g. 8am AND 2pm AND 9pm) —
 * index 0 keeps the original unsuffixed id, so a habit that only ever had one reminder time
 * (before multi-time support existed) keeps scheduling/cancelling under the same identifier. */
export function habitReminderId(habitId: number, index = 0): string {
  return index === 0 ? `habit-reminder-${habitId}` : `habit-reminder-${habitId}-${index}`;
}

export function habitAlarmId(habitId: number, index = 0): string {
  return index === 0 ? `habit-alarm-${habitId}` : `habit-alarm-${habitId}-${index}`;
}

/** `id` is a module_reminders row id — a module can have several reminders, each scheduling
 * independently under its own identifier. */
export function moduleReminderId(moduleKey: string, id: number): string {
  return `module-reminder-${moduleKey}-${id}`;
}

/** A single fixed identifier — unlike moduleReminderId there's only ever one of these, toggled
 * from Settings' Notifications section (see app/(tabs)/settings/index.tsx). */
export const SCOREBOARD_WEEKLY_REMINDER_ID = 'scoreboard-weekly-checkin';

/** Same single-fixed-identifier shape as SCOREBOARD_WEEKLY_REMINDER_ID above — scheduled
 * unconditionally on launch (see app/_layout.tsx) rather than behind its own settings toggle,
 * since a planning nudge is useful by default and there's only ever one of these. */
export const WEEKLY_REVIEW_REMINDER_ID = 'weekly-review-reminder';
