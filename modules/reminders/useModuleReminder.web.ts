import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
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
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

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

type ModuleReminderRow = {
  id: number;
  module_key: string;
  reminder_type: ReminderType;
  reminder_time: string | null;
  schedule_type: ScheduleType;
  schedule_days: string;
  hourly_start: string | null;
  hourly_end: string | null;
};

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
 * Web build of useModuleReminder.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any tab (or the sync engine) writing to
 * `module_reminders` for this moduleKey re-flows into every mounted instance automatically, so
 * no manual refresh() is needed after save/removal (kept as a no-op-returning function only so
 * callers that awaited it don't need changing).
 */
export function useModuleReminders(moduleKey: string, title: string, body: string) {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.module_reminders.toArray()) as ModuleReminderRow[];
    return all.filter((row) => row.module_key === moduleKey).sort((a, b) => a.id - b.id);
  }, [moduleKey]);

  const loading = rows === undefined;

  const reminders: ModuleReminder[] = (rows ?? []).map((row) => ({
    id: row.id,
    reminderType: row.reminder_type,
    time: row.reminder_time,
    scheduleType: row.schedule_type,
    scheduleDays: row.schedule_days ? JSON.parse(row.schedule_days) : [],
    hourlyStart: row.hourly_start,
    hourlyEnd: row.hourly_end,
  }));

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

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
        reminderId = (await webDb.module_reminders.add({
          module_key: moduleKey,
          enabled: next.reminderType !== 'none' ? 1 : 0,
          reminder_time: next.time,
          reminder_type: next.reminderType,
          schedule_type: next.scheduleType,
          schedule_days: JSON.stringify(next.scheduleDays),
          hourly_start: next.hourlyStart,
          hourly_end: next.hourlyEnd,
          updated_at: new Date().toISOString(),
          sync_id: Crypto.randomUUID(),
        } as never)) as number;
        await pushLocalRow('module_reminders', reminderId);
      } else {
        await webDb.module_reminders.update(reminderId, {
          enabled: next.reminderType !== 'none' ? 1 : 0,
          reminder_time: next.time,
          reminder_type: next.reminderType,
          schedule_type: next.scheduleType,
          schedule_days: JSON.stringify(next.scheduleDays),
          hourly_start: next.hourlyStart,
          hourly_end: next.hourlyEnd,
          updated_at: new Date().toISOString(),
        });
        await pushLocalRow('module_reminders', reminderId);
      }
      await applySchedule(reminderId, next);
      await refresh();
    },
    [moduleKey, applySchedule, refresh]
  );

  const addReminder = useCallback(() => save(null, DEFAULT_STATE), [save]);

  const removeReminder = useCallback(
    async (id: number) => {
      const baseId = moduleReminderId(moduleKey, id);
      await Promise.all(allReminderIds(baseId).flatMap((idStr) => [cancelReminder(idStr), cancelAlarm(idStr)]));
      await recordDeleteBeforeRemoving('module_reminders', id);
      await webDb.module_reminders.delete(id);
      await refresh();
    },
    [moduleKey, refresh]
  );

  return { reminders, loading, save, addReminder, removeReminder };
}
