import { cancelAlarm, cancelReminder, habitAlarmId, habitReminderId, requestNotificationPermissions, scheduleDailyAlarm, scheduleDailyReminder } from '@/notifications';
import type { Habit } from './types';

function parseTime(time: string): { hour: number; minute: number } | null {
  const [hour, minute] = time.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

/**
 * Reschedules (or cancels) a habit's daily reminder/alarm to match its
 * current settings — call after every create/update so the OS-level
 * schedule never drifts from what's in SQLite. Fires every day at the
 * chosen time regardless of which days the habit is actually due — a
 * known simplification, same as Tasks' reminder/alarm. The alarm variant
 * uses the same notifee-based full-screen ringing alarm as module reminders
 * (see notifications/alarm.ts), not a plain notification.
 */
export async function syncHabitNotifications(
  habit: Pick<Habit, 'id' | 'name' | 'reminder_time' | 'alarm_enabled'>
): Promise<void> {
  const time = habit.reminder_time ? parseTime(habit.reminder_time) : null;

  if (time) {
    const granted = await requestNotificationPermissions();
    if (granted) {
      await scheduleDailyReminder({
        identifier: habitReminderId(habit.id),
        title: habit.name,
        body: 'Time for your habit.',
        hour: time.hour,
        minute: time.minute,
      });
    }
  } else {
    await cancelReminder(habitReminderId(habit.id));
  }

  if (habit.alarm_enabled && time) {
    const granted = await requestNotificationPermissions();
    if (granted) {
      const identifier = habitAlarmId(habit.id);
      const title = `⏰ ${habit.name}`;
      const body = 'This habit is due now.';
      // Clears out anything scheduled at this ID by the old plain-notification alarm path.
      await cancelReminder(identifier);
      await scheduleDailyAlarm({ identifier, title, body, hour: time.hour, minute: time.minute, data: { kind: 'alarm', identifier, title, body } });
    }
  } else {
    await cancelReminder(habitAlarmId(habit.id));
    await cancelAlarm(habitAlarmId(habit.id));
  }
}

export async function cancelHabitNotifications(habitId: number): Promise<void> {
  await cancelReminder(habitReminderId(habitId));
  await cancelReminder(habitAlarmId(habitId));
  await cancelAlarm(habitAlarmId(habitId));
}
