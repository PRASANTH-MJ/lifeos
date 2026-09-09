import { cancelAlarm, cancelReminder, habitAlarmId, habitReminderId, requestNotificationPermissions, scheduleDailyAlarm, scheduleDailyReminder } from '@/notifications';
import { parseReminderTimes, type Habit } from './types';

/** A habit can have at most this many reminder times per day. Every identifier up to this index
 * is unconditionally cancelled on every save/removal (see `cancelHabitNotifications`), so shrinking
 * the list (or turning reminders off entirely) never leaves a stale notification/alarm behind —
 * same fixed-cap-of-identifiers idiom `useModuleReminders`' `allReminderIds` uses for its 24 hourly
 * slots. Ten is comfortably more than anyone types by hand in the "add another time" list. */
export const MAX_HABIT_REMINDER_TIMES = 10;

function parseTime(time: string): { hour: number; minute: number } | null {
  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

/**
 * Reschedules (or cancels) a habit's daily reminders/alarms to match its
 * current settings — call after every create/update so the OS-level
 * schedule never drifts from what's in SQLite. Each configured time fires
 * every day regardless of which days the habit is actually due — a known
 * simplification, same as Tasks' reminder/alarm. The alarm variant uses the
 * same notifee-based full-screen ringing alarm as module reminders (see
 * notifications/alarm.ts), not a plain notification. `alarm_enabled` applies
 * to every configured time — there's no per-time alarm toggle.
 */
export async function syncHabitNotifications(
  habit: Pick<Habit, 'id' | 'name' | 'reminder_time' | 'alarm_enabled'>
): Promise<void> {
  const times = parseReminderTimes(habit.reminder_time)
    .map(parseTime)
    .filter((t): t is { hour: number; minute: number } => t !== null)
    .slice(0, MAX_HABIT_REMINDER_TIMES);

  // Clear every identifier this habit could ever have scheduled under first — the number of
  // configured times may have shrunk (or gone to zero) since the last save, and both notification
  // systems share this identifier space regardless of which type a previous save used.
  await cancelHabitNotifications(habit.id);

  if (times.length === 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  for (const [index, time] of times.entries()) {
    await scheduleDailyReminder({
      identifier: habitReminderId(habit.id, index),
      title: habit.name,
      body: 'Time for your habit.',
      hour: time.hour,
      minute: time.minute,
    });

    if (habit.alarm_enabled) {
      const identifier = habitAlarmId(habit.id, index);
      const title = `⏰ ${habit.name}`;
      const body = 'This habit is due now.';
      await scheduleDailyAlarm({ identifier, title, body, hour: time.hour, minute: time.minute, data: { kind: 'alarm', identifier, title, body } });
    }
  }
}

export async function cancelHabitNotifications(habitId: number): Promise<void> {
  for (let index = 0; index < MAX_HABIT_REMINDER_TIMES; index += 1) {
    const reminderId = habitReminderId(habitId, index);
    const alarmId = habitAlarmId(habitId, index);
    await cancelReminder(reminderId);
    // Clears out anything scheduled at the alarm ID by the old plain-notification alarm path.
    await cancelReminder(alarmId);
    await cancelAlarm(alarmId);
  }
}
