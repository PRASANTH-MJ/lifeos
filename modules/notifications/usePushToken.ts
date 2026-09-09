import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { firestore } from '@/firebase/config';

function pushTokenDoc(uid: string) {
  return doc(firestore, 'users', uid, 'profile', 'pushTokens');
}

async function saveToken(uid: string, token: string) {
  await setDoc(pushTokenDoc(uid), { tokens: arrayUnion(token) }, { merge: true });
}

/** Fetches this device's Expo push token (no-ops if permission isn't granted, or on web) and
 * saves it to Firestore. Exported standalone (not just the hook below) so the Settings screen's
 * "enable notifications" permission-fix flow (see app/(tabs)/settings/index.tsx) can register a
 * token right after a fresh grant, not just on the next app launch. */
export async function registerPushToken(uid: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await saveToken(uid, token);
}

/** Registers this device's Expo push token once notification permission is already granted
 * (see notifications/setup.ts's requestNotificationPermissions — this hook never itself prompts,
 * it just reacts to a grant that already happened) and keeps it in Firestore at
 * users/{uid}/profile/pushTokens, the same owner-direct-write doc shape as
 * modules/profile/avatarSync.ts's avatar doc. `tokens` is a de-duplicated array (via
 * arrayUnion, which is a set add) rather than a single field, since one account can be signed
 * in on more than one device — functions/index.js's notify() fans a push out to all of them.
 * Native-only: Expo push tokens aren't a web concept. */
export function usePushToken(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid || Platform.OS === 'web') return;

    registerPushToken(uid).catch(() => {});

    // addPushTokenListener fires with the underlying native (FCM/APNs) device token, not an
    // Expo push token — re-deriving the Expo token means just calling getExpoPushTokenAsync()
    // again, exactly like the initial registration above, rather than saving this raw value.
    const subscription = Notifications.addPushTokenListener(() => {
      registerPushToken(uid).catch(() => {});
    });

    return () => subscription.remove();
  }, [uid]);
}
