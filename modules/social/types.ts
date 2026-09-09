import type { ShareCardData } from '@/components';

export type PublicProfile = {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  usernameLower: string;
  bio: string | null;
  isPrivate: boolean;
  isPro: boolean;
  habitStreak: number;
  /** JSON string array of `{ name, streak }` — one entry per non-periodic habit with a streak > 0
   * (see usePublicProfileStatsSync.ts) — used to match a club habit-streak challenge's
   * targetHabitName (case-insensitive substring) against this member's own habits, since members
   * each create their own habit rather than sharing one. `habitStreak` above (the plain max) predates
   * this and stays as-is for the existing Trophy Case display. */
  habitStreaks: string;
  cardioLogCount: number;
  cardioStreak: number;
  /** Cumulative distance (km) across every cardio log with a distance — synced alongside
   * cardioLogCount for distance-metric club challenges (see modules/clubs). */
  cardioDistanceKm: number;
  /** All-time counters for the other domains a club challenge can be scoped to (see
   * modules/clubs/challengeProgress.ts) — each mirrors cardioLogCount's shape (a running total
   * synced by usePublicProfileStatsSync.ts) rather than anything fabricated. workoutLogCount and
   * meditationLogCount/breathingLogCount are exact session counts; mealLogCount is a total logged-
   * meal count (there's no separate "hit your calorie goal" flag in the food module); and
   * waterGoalHitDays is a best-effort day count judged against the CURRENT water goal (see
   * useWaterGoalHitDays.ts), not a perfectly historically-accurate one. */
  workoutLogCount: number;
  mealLogCount: number;
  waterGoalHitDays: number;
  meditationLogCount: number;
  breathingLogCount: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

export type PostType = 'activity' | 'milestone' | 'text' | 'workoutTemplate';

/** A custom workout's exercise STRUCTURE (names, order, superset grouping) — deliberately never
 * the author's own personal log history, so importing it (see PostCard.tsx's "Import this
 * workout") gives the importer a fresh, empty copy of the routine, not a peek at someone else's
 * sets/reps history. `goal`/`equipment` are plain strings here (not modules/workout's
 * WorkoutGoal/Equipment) to keep this module free of a cross-domain type dependency; the importer
 * casts them back at the point it calls addWorkout. */
export type WorkoutTemplatePayload = {
  title: string;
  goal: string;
  equipment: string;
  minutes: number;
  exercises: { text: string; supersetGroup: number | null }[];
};

export type Post = {
  id: string;
  authorUid: string;
  authorUsernameLower: string;
  authorAvatarUrl: string | null;
  type: PostType;
  card: ShareCardData | null;
  photoUrl: string | null;
  /** Full carousel of photo URLs for a multi-card share (route map, stats card, streak card, a
   * user's own photo, etc. — see components/ActivityShareCarousel.tsx). Null for every
   * single-photo (or no-photo) post, old and new alike — `photoUrl` above always mirrors this
   * array's first entry (or the lone photo) so every existing single-photo reader (PostCard,
   * PublicPostPreview, sharePost.ts, functions/index.js's onPostCreated fan-out) keeps working
   * completely unchanged without knowing this field exists. Only readers that want the full
   * carousel (PostCard's PostPhotoCarousel) need to look at this. */
  photoUrls: string[] | null;
  caption: string | null;
  workoutTemplate: WorkoutTemplatePayload | null;
  createdAt: number | null;
};

export type FeedItem = {
  postId: string;
  authorUid: string;
  authorUsernameLower: string;
  authorAvatarUrl: string | null;
  type: PostType;
  card: ShareCardData | null;
  photoUrl: string | null;
  /** See Post.photoUrls above — mirrored into the per-follower feed fan-out doc by
   * onPostCreated so a feed reader gets the same carousel a direct posts/{id} reader would. */
  photoUrls: string[] | null;
  caption: string | null;
  workoutTemplate: WorkoutTemplatePayload | null;
  createdAt: number | null;
};

export type Comment = {
  id: string;
  authorUid: string;
  text: string;
  createdAt: number | null;
  /** Set when this comment was posted as a reply to another comment on the same post — null for
   * a top-level comment. Only one level deep (a reply's own replyToCommentId always points at a
   * top-level comment, never at another reply) — see PostCard.tsx's rendering. */
  replyToCommentId: string | null;
};

export type NotificationType = 'follow' | 'like' | 'comment';

export type SocialNotification = {
  id: string;
  type: NotificationType;
  fromUid: string;
  postId: string | null;
  message: string | null;
  read: boolean;
  createdAt: number | null;
};
