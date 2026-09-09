import type { Ionicons } from '@expo/vector-icons';

/** Small, fixed tag set aligned with this app's existing domains (see CardioActivity in
 * modules/cardio/types.ts and WorkoutGoal in modules/workout/types.ts) rather than inventing
 * unrelated club taxonomy. */
export type ClubCategory = 'running' | 'cycling' | 'strength' | 'mindfulness' | 'general';

export const CLUB_CATEGORIES: ClubCategory[] = ['running', 'cycling', 'strength', 'mindfulness', 'general'];

export const CLUB_CATEGORY_LABELS: Record<ClubCategory, string> = {
  running: 'Running',
  cycling: 'Cycling',
  strength: 'Strength',
  mindfulness: 'Mindfulness',
  general: 'General',
};

/** Up to this many tags per club — enough to describe a cross-category club (e.g. a "running +
 * mindfulness" recovery-run group) without categories turning into an unbounded free-for-all. */
export const CLUB_MAX_CATEGORIES = 3;

/** Shared minimum height for the club action button rows — the detail screen's 4-button row
 * (Invite/Challenge/Event/Leave) and the discovery hub's 3-button row (Open Chat/Invite/
 * Challenge) both use this same constant so neither row can end up taller than the other
 * regardless of label wrapping/font-scaling, on top of (not instead of) the per-Button
 * `shrinkToFit` fix for the wrapping itself. */
export const CLUB_ACTION_BUTTON_MIN_HEIGHT = 48;

export type ClubPrivacy = 'public' | 'inviteOnly' | 'private';

export const CLUB_PRIVACY_LABELS: Record<ClubPrivacy, string> = {
  public: 'Public',
  inviteOnly: 'Invite only',
  private: 'Private',
};

export type Club = {
  id: string;
  name: string;
  description: string | null;
  categories: ClubCategory[];
  photoUrl: string | null;
  memberCount: number;
  createdBy: string;
  /** Uids who can fully manage the club (edit name/photo/categories/privacy, promote/demote
   * roles, moderate content) — always includes createdBy, who can never be removed from it. */
  admins: string[];
  /** Uids with the narrower moderator tier below full admin: can remove a member or delete a
   * chat message/update, but can't touch roles, club settings, or the club itself. Disjoint from
   * `admins` — promoting someone to `admins` clears them from here (see setClubAdminRole). */
  subAdmins: string[];
  /** 'public': current default, discoverable and joinable by anyone. 'inviteOnly': still shows up
   * in discovery, but joining requires an existing clubs/{id}/invites/{uid} doc (see joinClub).
   * 'private': excluded from discovery/search entirely — firestore.rules only lets a member, an
   * admin, or someone with a pending invite read the club doc at all, so a direct deep link only
   * works for someone already invited. */
  privacy: ClubPrivacy;
};

/** 'sessions' tracks cardio session count (cardioLogCount); 'distanceKm' tracks cumulative
 * distance (cardioDistanceKm) — both are denormalized cardio totals already synced onto
 * userPublicProfiles by usePublicProfileStatsSync, so neither needs new per-activity data.
 * 'habitStreak' tracks a member's current streak on a specific *named* habit (see
 * `targetHabitName` below) — members each track their own separately-created habit rather than a
 * shared one, so matching is by name, not id (see usePublicProfileStatsSync's habitStreaks field
 * for the exact case-insensitive-substring heuristic and its limitations).
 *
 * The remaining five values back the non-cardio challenge categories (see `ChallengeCategory`
 * below): 'workoutSessions' (workoutLogCount), 'mealLogs' (mealLogCount — a total logged-meal
 * count, not a calorie-goal-hit count, since there's no such flag anywhere in the food module),
 * 'waterGoalDays' (waterGoalHitDays — a best-effort day count, see useWaterGoalHitDays.ts),
 * 'meditationSessions' (meditationLogCount), and 'breathingSessions' (breathingLogCount). Every
 * one of these mirrors 'sessions' — a running total synced by usePublicProfileStatsSync.ts, never
 * a fabricated number. */
export type ChallengeMetricType =
  | 'sessions'
  | 'distanceKm'
  | 'habitStreak'
  | 'workoutSessions'
  | 'mealLogs'
  | 'waterGoalDays'
  | 'meditationSessions'
  | 'breathingSessions';

/** The six activity domains a challenge can be created for (see challenge-new.tsx's category
 * picker). 'activity' is the original cardio-based challenge and is the only category with more
 * than one selectable metric (sessions/distance/habit-streak) — every other category maps 1:1
 * onto a single ChallengeMetricType (see CHALLENGE_CATEGORY_METRIC below), since each domain only
 * has one real per-user counter to challenge against. */
export type ChallengeCategory = 'workout' | 'food' | 'water' | 'meditation' | 'breathing' | 'activity';

export const CHALLENGE_CATEGORIES: ChallengeCategory[] = ['workout', 'food', 'water', 'meditation', 'breathing', 'activity'];

export const CHALLENGE_CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  workout: 'Workout',
  food: 'Food',
  water: 'Water',
  meditation: 'Meditation',
  breathing: 'Breathing',
  activity: 'Activity (Cardio)',
};

/** The single metric type each non-'activity' category maps to — 'activity' is intentionally
 * absent since it's the one category with a picker of its own (sessions/distanceKm/habitStreak). */
export const CHALLENGE_CATEGORY_METRIC: Record<Exclude<ChallengeCategory, 'activity'>, ChallengeMetricType> = {
  workout: 'workoutSessions',
  food: 'mealLogs',
  water: 'waterGoalDays',
  meditation: 'meditationSessions',
  breathing: 'breathingSessions',
};

/** Given a stored metricType, which category it belongs to — the inverse of
 * CHALLENGE_CATEGORY_METRIC, used to reconstruct `category` for challenge docs that predate this
 * field (every pre-existing challenge is a 'sessions'/'distanceKm'/'habitStreak' cardio challenge,
 * so it's always 'activity'). */
export function categoryForMetricType(metricType: ChallengeMetricType): ChallengeCategory {
  const entry = (Object.entries(CHALLENGE_CATEGORY_METRIC) as [ChallengeCategory, ChallengeMetricType][]).find(
    ([, metric]) => metric === metricType
  );
  return entry?.[0] ?? 'activity';
}

export type Challenge = {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  metricType: ChallengeMetricType;
  /** Target amount for `metricType` — a session count for 'sessions', a kilometer total for
   * 'distanceKm', or a streak-day count for 'habitStreak'. Kept as one field (rather than a
   * separate goalDistanceKm/goalStreakDays) since a challenge only ever tracks one metric at a
   * time. */
  goalSessions: number;
  /** The habit name to match against each member's own habits, case-insensitive substring — only
   * set (non-null) when metricType is 'habitStreak'. */
  targetHabitName: string | null;
  startDate: string;
  endDate: string;
  createdBy: string;
  participantCount: number;
  /** When true, participants are auto-split into two fixed teams at join time (see joinChallenge)
   * and progress is compared team-vs-team (sum of every member's individual progress) instead of
   * as an individual leaderboard — see challenge.tsx's team-mode rendering branch. */
  teamMode: boolean;
};

/** Which of the two fixed teams a participant was auto-assigned to — only meaningful when the
 * parent challenge's `teamMode` is true; null otherwise. */
export type ChallengeTeam = 'A' | 'B';

export type ChallengeParticipant = {
  uid: string;
  /** The participant's cardioLogCount or cardioDistanceKm (whichever `challenge.metricType`
   * selects) at the moment they joined — progress is simply the current value minus this, not a
   * separately-tracked running total. */
  startCount: number;
  team: ChallengeTeam | null;
};

/** Small, fixed tag set for what kind of gathering an event is — purely descriptive (an icon
 * badge on the event card/detail), doesn't change RSVP or capacity behavior. */
export type EventType = 'race' | 'groupWorkout' | 'social' | 'other';

export const EVENT_TYPES: EventType[] = ['race', 'groupWorkout', 'social', 'other'];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  race: 'Race',
  groupWorkout: 'Group workout',
  social: 'Social',
  other: 'Other',
};

export const EVENT_TYPE_ICONS: Record<EventType, keyof typeof Ionicons.glyphMap> = {
  race: 'trophy',
  groupWorkout: 'barbell',
  social: 'people',
  other: 'calendar',
};

export type FitnessEvent = {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  startsAtMs: number;
  createdBy: string;
  attendeeCount: number;
  /** When true, this doc is a recurring "template" (one weekly slot, not a single occurrence) —
   * see modules/clubs/recurringEvents.ts for how upcoming occurrence dates get computed from
   * `recurrenceDayOfWeek`, and useEvent.ts for how RSVPs get tracked per-occurrence-date instead
   * of once per doc. */
  recurring: boolean;
  recurrenceDayOfWeek: number | null;
  eventType: EventType;
  /** Max attendees, or null for unlimited (the original, pre-capacity behavior). Only enforced for
   * a plain (non-recurring) event — see joinEvent's reasoning for why a recurring template's
   * shared attendeeCount can't represent any one occurrence's headcount. Once attendeeCount reaches
   * this, a new RSVP goes onto the `waitlist` subcollection instead of `attendees` (see useEvent's
   * waitlist fields). */
  capacity: number | null;
};
