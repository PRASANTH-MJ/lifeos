import type { PublicProfile } from '@/modules/social';
import type { ChallengeMetricType } from './types';

/** 'habitStreak' has no startCount to subtract from (see functions/index.js's createChallenge) —
 * progress is just the matching habit's current streak, found by case-insensitive substring
 * against `targetHabitName` in the participant's synced habitStreaks JSON (see
 * usePublicProfileStatsSync). Shared by challenge.tsx's own leaderboard and any other screen that
 * needs a participant's live progress (see useChallengeProgress.ts) so the metric math never
 * drifts between call sites. */
export function metricProgress(profile: PublicProfile, startCount: number, metricType: ChallengeMetricType, targetHabitName: string | null): number {
  if (metricType === 'habitStreak') {
    if (!targetHabitName) return 0;
    const needle = targetHabitName.toLowerCase();
    try {
      const streaks = JSON.parse(profile.habitStreaks) as { name: string; streak: number }[];
      return streaks.find((s) => s.name.toLowerCase().includes(needle))?.streak ?? 0;
    } catch {
      return 0;
    }
  }
  const current = metricCurrentValue(profile, metricType);
  return Math.max(0, current - startCount);
}

/** The raw counter a given metricType reads off a profile — factored out so
 * functions/index.js's createChallenge/joinChallenge (which snapshot startCount from this same
 * field, just server-side) and metricProgress above never drift apart on which field means what. */
export function metricCurrentValue(profile: PublicProfile, metricType: ChallengeMetricType): number {
  switch (metricType) {
    case 'distanceKm':
      return profile.cardioDistanceKm;
    case 'workoutSessions':
      return profile.workoutLogCount;
    case 'mealLogs':
      return profile.mealLogCount;
    case 'waterGoalDays':
      return profile.waterGoalHitDays;
    case 'meditationSessions':
      return profile.meditationLogCount;
    case 'breathingSessions':
      return profile.breathingLogCount;
    case 'habitStreak':
      return 0; // Handled separately in metricProgress — no flat current value to read here.
    case 'sessions':
    default:
      return profile.cardioLogCount;
  }
}

export function goalUnitLabel(metricType: ChallengeMetricType): string {
  switch (metricType) {
    case 'distanceKm':
      return 'km';
    case 'habitStreak':
      return 'day streak';
    case 'workoutSessions':
      return 'workouts';
    case 'mealLogs':
      return 'meals logged';
    case 'waterGoalDays':
      return 'goal-hit days';
    case 'meditationSessions':
      return 'meditation sessions';
    case 'breathingSessions':
      return 'breathing sessions';
    case 'sessions':
    default:
      return 'sessions';
  }
}
