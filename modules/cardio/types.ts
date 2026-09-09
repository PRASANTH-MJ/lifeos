import type { Ionicons } from '@expo/vector-icons';

import type { RoutePoint } from './locationTracking';

export type CardioActivity = 'running' | 'walking' | 'hiking' | 'cycling' | 'swimming' | 'yoga' | 'sports';

export const CARDIO_ACTIVITIES: CardioActivity[] = ['running', 'walking', 'hiking', 'cycling', 'swimming', 'yoga', 'sports'];

export const CARDIO_ACTIVITY_LABELS: Record<CardioActivity, string> = {
  running: 'Running',
  walking: 'Walking',
  hiking: 'Hiking',
  cycling: 'Cycling',
  swimming: 'Swimming',
  yoga: 'Yoga',
  sports: 'Sports',
};

export const CARDIO_ACTIVITY_ICON: Record<CardioActivity, keyof typeof Ionicons.glyphMap> = {
  running: 'walk',
  walking: 'footsteps',
  hiking: 'trail-sign',
  cycling: 'bicycle',
  swimming: 'water',
  yoga: 'body',
  sports: 'basketball',
};

/** Which activities can be recorded live via GPS (native only) — shared between the per-activity
 * detail screen's "Record with GPS" button and the unified "Log Activity" picker, so the two
 * can't drift out of sync on which activities actually support it. */
export const GPS_RECORDABLE: CardioActivity[] = ['running', 'walking', 'hiking', 'cycling'];

/** Running/Walking/Hiking/Cycling log distance + duration and level up on cumulative distance;
 * Swimming/Yoga/Sports have no meaningful GPS "distance" (an outdoor route doesn't apply to
 * laps in a pool, or to a yoga/sports session) so they log duration only and level up on session
 * count. */
export const DISTANCE_ACTIVITIES: CardioActivity[] = ['running', 'walking', 'hiking', 'cycling'];

export function isDistanceActivity(activity: CardioActivity): boolean {
  return DISTANCE_ACTIVITIES.includes(activity);
}

export type CardioFrequency = 'daily' | 'weekly';

export type CardioIntensity = 'light' | 'moderate' | 'intense';

export const CARDIO_INTENSITIES: CardioIntensity[] = ['light', 'moderate', 'intense'];

export const CARDIO_INTENSITY_LABELS: Record<CardioIntensity, string> = {
  light: 'Light',
  moderate: 'Moderate',
  intense: 'Intense',
};

/** Curated picklist for "sports" — free-text ("Other") still available so nothing is a dead end. */
export const SPORT_OPTIONS = [
  'Basketball',
  'Football',
  'Tennis',
  'Badminton',
  'Cricket',
  'Swimming',
  'Cycling',
  'Table Tennis',
  'Volleyball',
  'Other',
];

/** Curated picklist for "yoga" poses/sessions — same free-text escape hatch as sports. */
export const YOGA_POSE_OPTIONS = [
  'Sun Salutation',
  'Downward Dog',
  'Warrior',
  'Tree Pose',
  "Child's Pose",
  'Cobra',
  'Bridge',
  'Savasana',
  'Other',
];

/** A quick self-reported "how did it feel" tag on the post-recording save screen — separate from
 * `intensity` (a pre-set target/effort level) since this is reported after the fact. */
export type CardioMood = 'great' | 'good' | 'ok' | 'tough';

export const CARDIO_MOODS: CardioMood[] = ['great', 'good', 'ok', 'tough'];

export const CARDIO_MOOD_LABELS: Record<CardioMood, string> = {
  great: 'Great',
  good: 'Good',
  ok: 'OK',
  tough: 'Tough',
};

/** A manual, fixed-picklist self-report — no weather API integration, purely for the user's own
 * pattern-spotting ("I always run slower when it's hot"). */
export type CardioWeather = 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'hot' | 'cold';

export const CARDIO_WEATHERS: CardioWeather[] = ['sunny', 'cloudy', 'rainy', 'windy', 'hot', 'cold'];

export const CARDIO_WEATHER_LABELS: Record<CardioWeather, string> = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rainy: 'Rainy',
  windy: 'Windy',
  hot: 'Hot',
  cold: 'Cold',
};

export const CARDIO_WEATHER_ICON: Record<CardioWeather, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny',
  cloudy: 'cloudy',
  rainy: 'rainy',
  windy: 'flag',
  hot: 'thermometer',
  cold: 'snow',
};

export type CardioLog = {
  id: number;
  activity: CardioActivity;
  date: string;
  distanceKm: number | null;
  durationMinutes: number;
  /** What specifically was done — a sport name or a yoga pose, picked from the curated lists
   * above (or free text via "Other"). Null for running/walking/hiking, which don't need it. */
  sportName: string | null;
  intensity: CardioIntensity | null;
  note: string | null;
  /** The recorded GPS route, if this log came from "Record with GPS" — null for manual entries,
   * non-GPS activities, and any log created before this column existed. */
  routePoints: RoutePoint[] | null;
  mood: CardioMood | null;
  photoUri: string | null;
  /** Cumulative elevation gain in meters, computed from GPS altitude deltas during recording —
   * null for manual entries, non-GPS activities, and any log created before this column existed. */
  elevationGainM: number | null;
  /** Shared across every leg of a "brick" session (e.g. run then bike) logged back-to-back via
   * "Add another leg to this session?" on the save screen — null for a standalone log. See
   * modules/cardio/combo.ts for how legs sharing this id are grouped for display. */
  comboGroupId: string | null;
  weather: CardioWeather | null;
  createdAt: string;
};

export type CardioActivityPrefs = {
  isRecurring: boolean;
  frequency: CardioFrequency;
  targetDays: number[];
};

export const DEFAULT_CARDIO_PREFS: CardioActivityPrefs = {
  isRecurring: false,
  frequency: 'daily',
  targetDays: [],
};
