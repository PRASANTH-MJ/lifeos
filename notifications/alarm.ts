import notifee, {
  AlarmType,
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  RepeatFrequency,
  TriggerType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const ALARM_CHANNEL_ID = 'alarm';

/** A distinct high-priority channel for true alarm-style notifications — separate from the
 * regular "default" channel expo-notifications uses for plain reminders, since a channel's
 * sound/vibration/bypassDnd settings can't be changed once created. */
export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Alarms',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      vibrationPattern: [500, 500, 500, 500, 500, 500],
    });
  } catch {
    // Best-effort — never block app startup on this, and notifee has no native module on web.
  }
}

function nextDailyTimestamp(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

/** `weekday` is 1–7, 1 = Sunday — matching the convention already used for expo-notifications'
 * WEEKLY trigger elsewhere in this app. */
function nextWeekdayTimestamp(weekday: number, hour: number, minute: number): number {
  const now = new Date();
  const currentWeekday = now.getDay() + 1;
  const daysUntil = (weekday - currentWeekday + 7) % 7;
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate.getTime();
}

type AlarmContent = {
  identifier: string;
  title: string;
  body: string;
  /** Carried through to the AlarmRingingScreen so it knows what to re-arm on snooze/what fired. */
  data: Record<string, string>;
};

function androidAlarmOptions(fullScreenId: string) {
  return {
    channelId: ALARM_CHANNEL_ID,
    category: AndroidCategory.ALARM,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    fullScreenAction: { id: fullScreenId },
    pressAction: { id: fullScreenId },
    ongoing: true,
    autoCancel: false,
  };
}

/** Never throws — notifee has no native module on web, and a scheduling failure here should
 * never break the reminder's save flow. */
async function safely(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch {
    // best-effort
  }
}

export function scheduleDailyAlarm(options: AlarmContent & { hour: number; minute: number }): Promise<void> {
  return safely(async () => {
    await notifee.createTriggerNotification(
      { id: options.identifier, title: options.title, body: options.body, data: options.data, android: androidAlarmOptions('default') },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: nextDailyTimestamp(options.hour, options.minute),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
      }
    );
  });
}

export function scheduleWeeklyAlarm(options: AlarmContent & { weekday: number; hour: number; minute: number }): Promise<void> {
  return safely(async () => {
    await notifee.createTriggerNotification(
      { id: options.identifier, title: options.title, body: options.body, data: options.data, android: androidAlarmOptions('default') },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: nextWeekdayTimestamp(options.weekday, options.hour, options.minute),
        repeatFrequency: RepeatFrequency.WEEKLY,
        alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
      }
    );
  });
}

export function scheduleOneTimeAlarm(options: AlarmContent & { date: Date }): Promise<void> {
  return safely(async () => {
    if (options.date.getTime() <= Date.now()) return;
    await notifee.createTriggerNotification(
      { id: options.identifier, title: options.title, body: options.body, data: options.data, android: androidAlarmOptions('default') },
      { type: TriggerType.TIMESTAMP, timestamp: options.date.getTime(), alarmManager: { type: AlarmType.SET_ALARM_CLOCK } }
    );
  });
}

export function cancelAlarm(identifier: string): Promise<void> {
  return safely(async () => {
    await notifee.cancelNotification(identifier);
  });
}
