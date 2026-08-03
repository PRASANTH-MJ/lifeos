import * as Crypto from 'expo-crypto';
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
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

export type ReminderType = 'none' | 'notification' | 'alarm';
export type ScheduleType = 'daily' | 'specific_days';

export type ModuleReminderState = {
  reminderType: ReminderType;
  time: string | null;
  scheduleType: ScheduleType;
  /** 1–7, 1 = Sunday, matching expo-notifications' own weekday convention. */
  scheduleDays: number[];
};

export type ModuleReminder = ModuleReminderState & { id: number };

export const DEFAULT_MODULE_REMINDER_STATE: ModuleReminderState = { reminderType: 'none', time: null, scheduleType: 'daily', scheduleDays: [] };
const DEFAULT_STATE = DEFAULT_MODULE_REMINDER_STATE;

/**
 * Every reminder for one module (Journal, Meditation, Breathing, Mind Training, Workout, Food,
 * Affirmations), backed by the shared `module_reminders` table — a module can have several (e.g.
 * a morning and an evening meditation reminder), each with its own *type* (silent/Notification/
 * Alarm) and *schedule* (every day, or specific weekdays). "Notification" is a plain
 * expo-notifications reminder; "Alarm" schedules a true full-screen, looping-sound alarm via
 * notifee (see notifications/alarm.ts and app/alarm-ringing.tsx) — both systems use the same
 * identifier space per reminder row, so every save cancels both before scheduling whichever type
 * is current.
 */
export function useModuleReminders(moduleKey: string, title: string, body: string) {
  const db = useSQLiteContext();
  const [reminders, setReminders] = useState<ModuleReminder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{
        id: number;
        reminder_type: ReminderType;
        reminder_time: string | null;
        schedule_type: ScheduleType;
        schedule_days: string;
      }>('SELECT id, reminder_type, reminder_time, schedule_type, schedule_days FROM module_reminders WHERE module_key = ? ORDER BY id', [moduleKey]);
      setReminders(
        rows.map((row) => ({
          id: row.id,
          reminderType: row.reminder_type,
          time: row.reminder_time,
          scheduleType: row.schedule_type,
          scheduleDays: row.schedule_days ? JSON.parse(row.schedule_days) : [],
        }))
      );
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
    async (id: number, next: ModuleReminderState) => {
      const baseId = moduleReminderId(moduleKey, id);
      const allIds = [baseId, ...Array.from({ length: 7 }, (_, i) => `${baseId}-${i + 1}`)];
      // Both notification systems share this identifier space — clear both regardless of which
      // one a previous save used, so switching type/schedule never leaves a stale alarm behind.
      await Promise.all(allIds.flatMap((idStr) => [cancelReminder(idStr), cancelAlarm(idStr)]));

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
            const weekdayId = `${baseId}-${weekday}`;
            await scheduleWeeklyAlarm({ identifier: weekdayId, title: alarmTitle, body, weekday, hour, minute, data: { kind: 'alarm', identifier: weekdayId, title: alarmTitle, body } });
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
    async (id: number | null, next: ModuleReminderState) => {
      let reminderId = id;
      if (reminderId == null) {
        const result = await db.runAsync(
          `INSERT INTO module_reminders (module_key, enabled, reminder_time, reminder_type, schedule_type, schedule_days, updated_at, sync_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            moduleKey,
            next.reminderType !== 'none' ? 1 : 0,
            next.time,
            next.reminderType,
            next.scheduleType,
            JSON.stringify(next.scheduleDays),
            new Date().toISOString(),
            Crypto.randomUUID(),
          ]
        );
        reminderId = result.lastInsertRowId;
        await pushLocalRow(db, 'module_reminders', reminderId);
      } else {
        await db.runAsync(
          `UPDATE module_reminders SET enabled = ?, reminder_time = ?, reminder_type = ?, schedule_type = ?, schedule_days = ?, updated_at = ? WHERE id = ?`,
          [next.reminderType !== 'none' ? 1 : 0, next.time, next.reminderType, next.scheduleType, JSON.stringify(next.scheduleDays), new Date().toISOString(), reminderId]
        );
        await pushLocalRow(db, 'module_reminders', reminderId);
      }
      await applySchedule(reminderId, next);
      await refresh();
    },
    [db, moduleKey, applySchedule, refresh]
  );

  const addReminder = useCallback(() => save(null, DEFAULT_STATE), [save]);

  const removeReminder = useCallback(
    async (id: number) => {
      const baseId = moduleReminderId(moduleKey, id);
      const allIds = [baseId, ...Array.from({ length: 7 }, (_, i) => `${baseId}-${i + 1}`)];
      await Promise.all(allIds.flatMap((idStr) => [cancelReminder(idStr), cancelAlarm(idStr)]));
      await recordDeleteBeforeRemoving(db, 'module_reminders', id);
      await db.runAsync('DELETE FROM module_reminders WHERE id = ?', [id]);
      await refresh();
    },
    [db, moduleKey, refresh]
  );

  return { reminders, loading, save, addReminder, removeReminder };
}
