import { cancelReminder, habitAlarmId, habitReminderId, requestNotificationPermissions, scheduleDailyReminder } from '@/notifications';
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
 * known simplification, same as Tasks' reminder/alarm.
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
      await scheduleDailyReminder({
        identifier: habitAlarmId(habit.id),
        title: `⏰ ${habit.name}`,
        body: 'This habit is due now.',
        hour: time.hour,
        minute: time.minute,
      });
    }
  } else {
    await cancelReminder(habitAlarmId(habit.id));
  }
}

export async function cancelHabitNotifications(habitId: number): Promise<void> {
  await cancelReminder(habitReminderId(habitId));
  await cancelReminder(habitAlarmId(habitId));
}
