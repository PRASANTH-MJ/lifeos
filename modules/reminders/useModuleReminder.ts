import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import {
  cancelAlarm,
  cancelReminder,
  moduleReminderId,
  requestNotificationPermissions,
  scheduleDailyAlarm,
  scheduleDailyReminder,
  scheduleWeeklyAlarm,
  scheduleWeeklyReminder,
} from '@/notifications';

export type ReminderType = 'none' | 'notification' | 'alarm';
export type ScheduleType = 'daily' | 'specific_days';

export type ModuleReminderState = {
  reminderType: ReminderType;
  time: string | null;
  scheduleType: ScheduleType;
  /** 1–7, 1 = Sunday, matching expo-notifications' own weekday convention. */
  scheduleDays: number[];
};

const DEFAULT_STATE: ModuleReminderState = { reminderType: 'none', time: null, scheduleType: 'daily', scheduleDays: [] };

/**
 * One reminder per module (Journal, Meditation, Breathing, Mind Training, Workout, Food,
 * Affirmations), backed by the shared `module_reminders` table. Supports a reminder *type*
 * (silent/Notification/Alarm) and a *schedule* (every day, or specific weekdays). "Notification"
 * is a plain expo-notifications reminder; "Alarm" schedules a true full-screen, looping-sound
 * alarm via notifee (see notifications/alarm.ts and app/alarm-ringing.tsx) — both systems use the
 * same identifier space, so every save cancels both before scheduling whichever type is current.
 */
export function useModuleReminder(moduleKey: string, title: string, body: string) {
  const db = useSQLiteContext();
  const [state, setState] = useState<ModuleReminderState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const row = await db.getFirstAsync<{
        reminder_type: ReminderType;
        reminder_time: string | null;
        schedule_type: ScheduleType;
        schedule_days: string;
      }>('SELECT reminder_type, reminder_time, schedule_type, schedule_days FROM module_reminders WHERE module_key = ?', [moduleKey]);
      setState({
        reminderType: row?.reminder_type ?? 'none',
        time: row?.reminder_time ?? null,
        scheduleType: row?.schedule_type ?? 'daily',
        scheduleDays: row?.schedule_days ? JSON.parse(row.schedule_days) : [],
      });
    } finally {
      setLoading(false);
    }
  }, [db, moduleKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const applySchedule = useCallback(
    async (next: ModuleReminderState) => {
      const baseId = moduleReminderId(moduleKey);
      const allIds = [baseId, ...Array.from({ length: 7 }, (_, i) => `${baseId}-${i + 1}`)];
      // Both notification systems share this identifier space — clear both regardless of which
      // one a previous save used, so switching type/schedule never leaves a stale alarm behind.
      await Promise.all(allIds.flatMap((id) => [cancelReminder(id), cancelAlarm(id)]));

      if (next.reminderType === 'none' || !next.time) return;
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      const [hour, minute] = next.time.split(':').map(Number);

      if (next.reminderType === 'alarm') {
        const alarmTitle = `⏰ ${title}`;
        if (next.scheduleType === 'daily') {
          await scheduleDailyAlarm({ identifier: baseId, title: alarmTitle, body, hour, minute, data: { kind: 'alarm', identifier: baseId, title: alarmTitle, body } });
        } else {
          for (const weekday of next.scheduleDays) {
            const id = `${baseId}-${weekday}`;
            await scheduleWeeklyAlarm({ identifier: id, title: alarmTitle, body, weekday, hour, minute, data: { kind: 'alarm', identifier: id, title: alarmTitle, body } });
          }
        }
      } else if (next.scheduleType === 'daily') {
        await scheduleDailyReminder({ identifier: baseId, title, body, hour, minute });
      } else {
        for (const weekday of next.scheduleDays) {
          await scheduleWeeklyReminder({ identifier: `${baseId}-${weekday}`, title, body, weekday, hour, minute });
        }
      }
    },
    [moduleKey, title, body]
  );

  const save = useCallback(
    async (next: ModuleReminderState) => {
      await db.runAsync(
        `INSERT INTO module_reminders (module_key, enabled, reminder_time, reminder_type, schedule_type, schedule_days, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(module_key) DO UPDATE SET
           enabled = excluded.enabled,
           reminder_time = excluded.reminder_time,
           reminder_type = excluded.reminder_type,
           schedule_type = excluded.schedule_type,
           schedule_days = excluded.schedule_days,
           updated_at = excluded.updated_at`,
        [
          moduleKey,
          next.reminderType !== 'none' ? 1 : 0,
          next.time,
          next.reminderType,
          next.scheduleType,
          JSON.stringify(next.scheduleDays),
          new Date().toISOString(),
        ]
      );
      setState(next);
      await applySchedule(next);
    },
    [db, moduleKey, applySchedule]
  );

  return { ...state, loading, save };
}
