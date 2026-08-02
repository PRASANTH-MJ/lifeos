import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import {
  cancelReminder,
  moduleReminderId,
  requestNotificationPermissions,
  scheduleDailyReminder,
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
 * (silent/Notification/Alarm-style sound) and a *schedule* (every day, or specific weekdays) —
 * "Alarm" plays a sound and gets a ⏰ title prefix, but is still a one-shot local notification,
 * not a continuously-ringing alarm-clock (that needs a native module LifeOS doesn't have).
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
      await cancelReminder(baseId);
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        await cancelReminder(`${baseId}-${weekday}`);
      }

      if (next.reminderType === 'none' || !next.time) return;
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      const [hour, minute] = next.time.split(':').map(Number);
      const finalTitle = next.reminderType === 'alarm' ? `⏰ ${title}` : title;
      const sound = next.reminderType === 'alarm';

      if (next.scheduleType === 'daily') {
        await scheduleDailyReminder({ identifier: baseId, title: finalTitle, body, hour, minute, sound });
      } else {
        for (const weekday of next.scheduleDays) {
          await scheduleWeeklyReminder({ identifier: `${baseId}-${weekday}`, title: finalTitle, body, weekday, hour, minute, sound });
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
