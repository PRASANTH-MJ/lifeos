import notifee, { AndroidNotificationSetting } from '@notifee/react-native';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export type NotificationPermissionSnapshot = {
  notifications: PermissionState;
  /** Whether calling requestNotificationPermissions() again would show the OS dialog, vs.
   * silently no-op because the user already denied it once — Android only shows the prompt once. */
  canAskAgain: boolean;
  /** Android's "Alarms & reminders" special access. Not required for the SET_ALARM_CLOCK trigger
   * type this app uses, but surfaced anyway since some OEMs still gate reliable delivery on it. */
  alarms: PermissionState;
};

export async function getNotificationPermissionSnapshot(): Promise<NotificationPermissionSnapshot> {
  if (Platform.OS === 'web') {
    return { notifications: 'unsupported', canAskAgain: false, alarms: 'unsupported' };
  }

  const current = await Notifications.getPermissionsAsync();
  const notifications: PermissionState = current.granted ? 'granted' : current.canAskAgain ? 'undetermined' : 'denied';

  let alarms: PermissionState = 'unsupported';
  if (Platform.OS === 'android') {
    try {
      const settings = await notifee.getNotificationSettings();
      alarms =
        settings.android.alarm === AndroidNotificationSetting.ENABLED
          ? 'granted'
          : settings.android.alarm === AndroidNotificationSetting.DISABLED
            ? 'denied'
            : 'unsupported';
    } catch {
      alarms = 'unsupported';
    }
  }

  return { notifications, canAskAgain: current.canAskAgain, alarms };
}

/** Deep-links into this app's OS notification settings page — the only way to grant
 * notification access once the user has denied the in-app prompt once on Android. */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

/** Deep-links into Android's "Alarms & reminders" special access screen for this app.
 * No-ops on iOS/web and on Android < 12. */
export function openAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  return notifee.openAlarmPermissionSettings().catch(() => {});
}
