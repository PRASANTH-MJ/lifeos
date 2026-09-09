import type { Ionicons } from '@expo/vector-icons';

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * Plain hardcoded list, newest first — no CMS or backend, edited by hand alongside whatever
 * shipped. `version` doubles as the "have I seen this" marker (see useSettings's
 * lastSeenChangelogVersion): bump it whenever a new entry is added to the top so the More tab's
 * badge dot reappears, and nowhere else.
 */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '2026-08-30',
    date: 'Aug 2026',
    title: 'Weekly Recap',
    description: 'A once-a-week summary card on the Life Scoreboard — your score trend, streaks, and challenge progress in one place.',
    icon: 'calendar',
  },
  {
    version: '2026-05-15',
    date: 'May 2026',
    title: '9 Color Themes',
    description: 'Restyle the whole app from Settings — nine themes to match your mood, including a few darker, moodier options.',
    icon: 'color-palette',
  },
  {
    version: '2026-03-10',
    date: 'Mar 2026',
    title: 'Accountability Partner Improvements',
    description: 'Faster syncing, a shared goal you both check in on, and a side-by-side comparison of your stats.',
    icon: 'people',
  },
  {
    version: '2026-01-20',
    date: 'Jan 2026',
    title: 'Club Challenges & Events',
    description: 'Join a club challenge with a shared leaderboard, or RSVP to a club event — all inside Clubs.',
    icon: 'trophy',
  },
  {
    version: '2025-11-05',
    date: 'Nov 2025',
    title: 'Life Scoreboard',
    description: 'A single balance score across physical, mental, spiritual, financial, and relationship health — built from data already in the app.',
    icon: 'podium-outline',
  },
];

/** The newest entry's version — what a fresh "seen" marker gets compared against. */
export const LATEST_CHANGELOG_VERSION = CHANGELOG_ENTRIES[0].version;
