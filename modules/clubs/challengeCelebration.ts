import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'challenge-celebrated:';

/** Per-challenge "has the completion celebration already been shown" flag — same AsyncStorage
 * one-time-flag shape as modules/onboarding/AppTourModal's TOUR_SEEN_KEY, just keyed per
 * challenge instead of a single global key. */
export async function hasCelebratedChallenge(challengeId: string): Promise<boolean> {
  const seen = await AsyncStorage.getItem(KEY_PREFIX + challengeId);
  return !!seen;
}

export function markChallengeCelebrated(challengeId: string): void {
  AsyncStorage.setItem(KEY_PREFIX + challengeId, '1').catch(() => {});
}
