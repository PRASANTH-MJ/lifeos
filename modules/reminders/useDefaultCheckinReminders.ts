import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { useModuleReminders, type ModuleReminderState } from './useModuleReminder';

const PROVISIONED_KEY = 'default-checkin-reminders-v1';

const MORNING_DEFAULT: ModuleReminderState = {
  reminderType: 'notification',
  time: '08:00',
  scheduleType: 'daily',
  scheduleDays: [],
  hourlyStart: null,
  hourlyEnd: null,
};

const NIGHT_DEFAULT: ModuleReminderState = {
  reminderType: 'notification',
  time: '21:00',
  scheduleType: 'daily',
  scheduleDays: [],
  hourlyStart: null,
  hourlyEnd: null,
};

/**
 * Every user gets a morning check-in (8am) and night check-in (9pm) reminder turned on
 * automatically, the first time this hook mounts after the flag below is unset — a one-time
 * provisioning, not a standing default, so a user who later removes either reminder never has it
 * silently reappear. Kept as its own moduleKey ('morning-checkin'/'night-checkin'), separate from
 * the generic 'journal' reminder Journal already offers, so removing/editing one never touches
 * the other. Mounted once, globally (see (tabs)/_layout.tsx), so provisioning doesn't depend on
 * the user ever opening the Journal tab.
 */
export function useDefaultCheckinReminders() {
  const morning = useModuleReminders('morning-checkin', 'Morning check-in', 'Start your day with a quick check-in.');
  const night = useModuleReminders('night-checkin', 'Night check-in', 'Wind down with an evening reflection.');
  const provisioning = useRef(false);

  useEffect(() => {
    if (morning.loading || night.loading || provisioning.current) return;
    if (morning.reminders.length > 0 || night.reminders.length > 0) return;

    provisioning.current = true;
    AsyncStorage.getItem(PROVISIONED_KEY).then(async (raw) => {
      if (raw) {
        provisioning.current = false;
        return;
      }
      await Promise.all([morning.save(null, MORNING_DEFAULT), night.save(null, NIGHT_DEFAULT)]);
      await AsyncStorage.setItem(PROVISIONED_KEY, '1');
      provisioning.current = false;
    });
  }, [morning.loading, night.loading, morning.reminders.length, night.reminders.length]);

  return { morning, night };
}
