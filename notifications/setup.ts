import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android 8+ won't show a notification at all without a channel to route it through — this
 * must run every time (not just on first grant), since a previous run could have been granted
 * permission without ever successfully creating the channel (e.g. permission pre-granted by the
 * OS before this code ever ran). */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureAndroidChannel();
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });

  await ensureAndroidChannel();

  return requested.granted ?? requested.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
}
