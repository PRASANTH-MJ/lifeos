import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'event-recap-prompted:';

/** Per-event "has the post-event recap prompt already been shown" flag — same one-time
 * AsyncStorage shape as modules/clubs/challengeCelebration.ts. */
export async function hasPromptedEventRecap(eventId: string): Promise<boolean> {
  const seen = await AsyncStorage.getItem(KEY_PREFIX + eventId);
  return !!seen;
}

export function markEventRecapPrompted(eventId: string): void {
  AsyncStorage.setItem(KEY_PREFIX + eventId, '1').catch(() => {});
}
