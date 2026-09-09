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
export type ScheduleType = 'daily' | 'specific_days' | 'hourly';

export type ModuleReminderState = {
  reminderType: ReminderType;
  time: string | null;
  scheduleType: ScheduleType;
  /** 1–7, 1 = Sunday, matching expo-notifications' own weekday convention. */
  scheduleDays: number[];
  /** Only used when scheduleType === 'hourly' — a window of "HH:MM" strings. Every hour mark
   * from hourlyStart's hour to hourlyEnd's hour (inclusive) fires, each at hourlyStart's minute
   * (so a 08:15–21:00 window rings at 08:15, 09:15, … 21:15 — a consistent minutes-past-the-hour
   * offset rather than forcing :00). */
  hourlyStart: string | null;
  hourlyEnd: string | null;
};

export type ModuleReminder = ModuleReminderState & { id: number };

export const DEFAULT_MODULE_REMINDER_STATE: ModuleReminderState = {
  reminderType: 'none',
  time: null,
  scheduleType: 'daily',
  scheduleDays: [],
  hourlyStart: null,
  hourlyEnd: null,
};
const DEFAULT_STATE = DEFAULT_MODULE_REMINDER_STATE;

/** Every hour mark an 'hourly' schedule fires at, as {hour, minute} — from hourlyStart's hour
 * through hourlyEnd's hour inclusive, each at hourlyStart's minute. Empty if either bound is
 * missing or the window is inverted. */
function hourlyMarks(hourlyStart: string | null, hourlyEnd: string | null): { hour: number; minute: number }[] {
  if (!hourlyStart || !hourlyEnd) return [];
  const [startHour, startMinute] = hourlyStart.split(':').map(Number);
  const [endHour] = hourlyEnd.split(':').map(Number);
  if (endHour < startHour) return [];
  const marks: { hour: number; minute: number }[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    marks.push({ hour, minute: startMinute });
  }
  return marks;
}

/** Every identifier a reminder could ever have scheduled under, across all three schedule types
 * (base id for 'daily', 7 weekday-suffixed ids for 'specific_days', 24 hour-suffixed ids for
 * 'hourly') — cancelled unconditionally on every save/removal so switching type/schedule or
 * deleting a reminder never leaves a stale notification or alarm behind. */
function allReminderIds(baseId: string): string[] {
  return [
    baseId,
    ...Array.from({ length: 7 }, (_, i) => `${baseId}-${i + 1}`),
    ...Array.from({ length: 24 }, (_, hour) => `${baseId}-hourly-${hour}`),
  ];
}

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
        hourly_start: string | null;
        hourly_end: string | null;
      }>(
        'SELECT id, reminder_type, reminder_time, schedule_type, schedule_days, hourly_start, hourly_end FROM module_reminders WHERE module_key = ? ORDER BY id',
        [moduleKey]
      );
      setReminders(
        rows.map((row) => ({
          id: row.id,
          reminderType: row.reminder_type,
          time: row.reminder_time,
          scheduleType: row.schedule_type,
          scheduleDays: row.schedule_days ? JSON.parse(row.schedule_days) : [],
          hourlyStart: row.hourly_start,
          hourlyEnd: row.hourly_end,
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
      // Both notification systems share this identifier space — clear both regardless of which
      // one a previous save used, so switching type/schedule never leaves a stale alarm behind.
      await Promise.all(allReminderIds(baseId).flatMap((idStr) => [cancelReminder(idStr), cancelAlarm(idStr)]));

      if (next.reminderType === 'none') return;
      if (next.scheduleType === 'hourly' ? hourlyMarks(next.hourlyStart, next.hourlyEnd).length === 0 : !next.time) return;
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      if (next.scheduleType === 'hourly') {
        for (const { hour, minute } of hourlyMarks(next.hourlyStart, next.hourlyEnd)) {
          const hourlyId = `${baseId}-hourly-${hour}`;
          if (next.reminderType === 'alarm') {
            const alarmTitle = `⏰ ${title}`;
            await scheduleDailyAlarm({ identifier: hourlyId, title: alarmTitle, body, hour, minute, data: { kind: 'alarm', identifier: hourlyId, title: alarmTitle, body } });
          } else {
            await scheduleDailyReminder({ identifier: hourlyId, title, body, hour, minute });
          }
        }
        return;
      }

      const [hour, minute] = next.time!.split(':').map(Number);

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
          `INSERT INTO module_reminders (module_key, enabled, reminder_time, reminder_type, schedule_type, schedule_days, hourly_start, hourly_end, updated_at, sync_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            moduleKey,
            next.reminderType !== 'none' ? 1 : 0,
            next.time,
            next.reminderType,
            next.scheduleType,
            JSON.stringify(next.scheduleDays),
            next.hourlyStart,
            next.hourlyEnd,
            new Date().toISOString(),
            Crypto.randomUUID(),
          ]
        );
        reminderId = result.lastInsertRowId;
        await pushLocalRow(db, 'module_reminders', reminderId);
      } else {
        await db.runAsync(
          `UPDATE module_reminders SET enabled = ?, reminder_time = ?, reminder_type = ?, schedule_type = ?, schedule_days = ?, hourly_start = ?, hourly_end = ?, updated_at = ? WHERE id = ?`,
          [
            next.reminderType !== 'none' ? 1 : 0,
            next.time,
            next.reminderType,
            next.scheduleType,
            JSON.stringify(next.scheduleDays),
            next.hourlyStart,
            next.hourlyEnd,
            new Date().toISOString(),
            reminderId,
          ]
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
      await Promise.all(allReminderIds(baseId).flatMap((idStr) => [cancelReminder(idStr), cancelAlarm(idStr)]));
      await recordDeleteBeforeRemoving(db, 'module_reminders', id);
      await db.runAsync('DELETE FROM module_reminders WHERE id = ?', [id]);
      await refresh();
    },
    [db, moduleKey, refresh]
  );

  return { reminders, loading, save, addReminder, removeReminder };
}
