/** A small curated set of ready-made challenges a club admin can start with one tap (see
 * challenge-new.tsx's "Seasonal challenges" quick-pick) instead of filling in title/goal/duration
 * from scratch. These are evergreen content, not tied to any real calendar date: `durationDays` is
 * applied starting from whenever the admin actually activates one (same `todayKey()` +
 * `addDays()` window every other challenge uses), so a "New Year Reset" started in July still runs
 * a normal 31-day window from today rather than assuming it's January. Picking one only pre-fills
 * the create form — the admin still reviews/edits every field and taps Create Challenge themselves,
 * same as any other template feature in this app (see modules/tasks/TaskForm.tsx, HabitForm.tsx). */
import type { ChallengeMetricType } from './types';

export type SeasonalChallengeTemplate = {
  id: string;
  /** Short quick-pick chip label — kept separate from `title` so the chip stays a couple of words
   * even for a template whose prefilled title is a longer sentence. */
  name: string;
  title: string;
  description: string;
  /** Omitted on the original seasonal templates, which predate distance-based challenges — they
   * default to 'sessions' at the apply site (challenge-new.tsx's applyTemplate). */
  metricType?: ChallengeMetricType;
  goalSessions: number;
  durationDays: number;
};

export const SEASONAL_CHALLENGE_TEMPLATES: SeasonalChallengeTemplate[] = [
  {
    id: 'new-year-reset',
    name: 'New Year Reset',
    title: 'New Year Reset',
    description: '30 workouts to build a strong habit right out of the gate — any activity counts.',
    goalSessions: 30,
    durationDays: 31,
  },
  {
    id: 'summer-shape-up',
    name: 'Summer Shape-Up',
    title: 'Summer Shape-Up',
    description: '40 cardio sessions over six weeks — show up consistently and keep each other honest.',
    goalSessions: 40,
    durationDays: 42,
  },
  {
    id: 'spring-reset',
    name: 'Spring Reset',
    title: 'Spring Reset',
    description: '20 sessions in three weeks — a shorter push to shake off a slump.',
    goalSessions: 20,
    durationDays: 21,
  },
  {
    id: 'year-end-streak',
    name: 'Year-End Streak',
    title: 'Year-End Streak',
    description: '25 sessions to close out the year strong instead of coasting through it.',
    goalSessions: 25,
    durationDays: 35,
  },
  {
    id: 'couch-to-5k',
    name: 'Couch to 5K',
    title: 'Couch to 5K',
    description: '25km of cumulative distance over eight weeks — a gentle on-ramp for anyone building up to their first 5K.',
    metricType: 'distanceKm',
    goalSessions: 25,
    durationDays: 56,
  },
  {
    id: 'consistency-streak',
    name: 'Consistency Streak',
    title: 'Consistency Streak',
    description: '6 sessions in two weeks — a short, low-pressure push to build momentum.',
    metricType: 'sessions',
    goalSessions: 6,
    durationDays: 14,
  },
  {
    id: 'distance-builder',
    name: 'Distance Builder',
    title: 'Distance Builder',
    description: '50km of cumulative distance over five weeks for anyone steadily building endurance.',
    metricType: 'distanceKm',
    goalSessions: 50,
    durationDays: 35,
  },
];
