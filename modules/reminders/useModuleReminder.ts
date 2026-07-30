import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { cancelReminder, moduleReminderId, requestNotificationPermissions, scheduleDailyReminder } from '@/notifications';

/**
 * One daily reminder/alarm toggle per module (Journal, Meditation, Breathing, Mind Training,
 * Workout, Food, Affirmations), backed by the shared `module_reminders` table — a single row
 * keyed by `moduleKey` rather than a bespoke table per module.
 */
export function useModuleReminder(moduleKey: string, title: string, body: string) {
  const db = useSQLiteContext();
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const row = await db.getFirstAsync<{ enabled: number; reminder_time: string | null }>(
        'SELECT enabled, reminder_time FROM module_reminders WHERE module_key = ?',
        [moduleKey]
      );
      setEnabled(!!row?.enabled);
      setTime(row?.reminder_time ?? null);
    } finally {
      setLoading(false);
    }
  }, [db, moduleKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const save = useCallback(
    async (nextEnabled: boolean, nextTime: string | null) => {
      await db.runAsync(
        `INSERT INTO module_reminders (module_key, enabled, reminder_time, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(module_key) DO UPDATE SET enabled = excluded.enabled, reminder_time = excluded.reminder_time, updated_at = excluded.updated_at`,
        [moduleKey, nextEnabled ? 1 : 0, nextTime, new Date().toISOString()]
      );
      setEnabled(nextEnabled);
      setTime(nextTime);

      const identifier = moduleReminderId(moduleKey);
      if (nextEnabled && nextTime) {
        const granted = await requestNotificationPermissions();
        if (granted) {
          const [hour, minute] = nextTime.split(':').map(Number);
          await scheduleDailyReminder({ identifier, title, body, hour, minute });
        }
      } else {
        await cancelReminder(identifier);
      }
    },
    [db, moduleKey, title, body]
  );

  return { enabled, time, loading, save };
}
