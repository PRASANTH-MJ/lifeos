import { doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';

import { auth, firestore } from '@/firebase/config';
import { computeCardioStreak, useCardioLogs } from '@/modules/cardio';
import { useHabits } from '@/modules/habits';
import { useFoodLogCount } from '@/modules/food';
import { useWaterGoalHitDays } from '@/modules/water';
import { useMeditationLogs } from '@/modules/meditation';
import { useBreathingLogs } from '@/modules/breathing';
import { useWorkoutLogs } from '@/modules/workout';

/** Keeps habitStreak/habitStreaks/cardioLogCount/cardioDistanceKm and the per-domain
 * workoutLogCount/mealLogCount/waterGoalHitDays/meditationLogCount/breathingLogCount counters on
 * the signed-in user's own userPublicProfiles doc current — all local, per-device data (SQLite),
 * so without this, the Streak stat, Trophy Case, and any club challenge (distance/habit-streak/
 * workout/food/water/meditation/breathing — see modules/clubs/challengeProgress.ts) could only
 * ever be computed for your OWN profile; a follower (or fellow challenge participant) viewing
 * someone else's profile has no way to read their SQLite data directly. Mounted once at the app
 * root (see app/(tabs)/_layout.tsx) — reacting to these values regardless of which screen is open,
 * not just while the Profile screen happens to be mounted. No-ops silently if the profile doc
 * doesn't exist yet (username not claimed) — firestore.rules' `update` (not `create`) only applies
 * once it does. */
export function usePublicProfileStatsSync() {
  const myUid = auth.currentUser?.uid;
  const { habits } = useHabits();
  const { logs: cardioLogs } = useCardioLogs();
  const { logs: workoutLogs } = useWorkoutLogs();
  const { logs: meditationLogs } = useMeditationLogs();
  const { logs: breathingLogs } = useBreathingLogs();
  const mealLogCount = useFoodLogCount();
  const waterGoalHitDays = useWaterGoalHitDays();
  const habitStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  // Per-habit-name streaks, for club habit-streak challenges to match by name (see
  // modules/clubs/types.ts's ChallengeMetricType doc comment) — only habits with a live streak are
  // worth sending, keeping this small; periodic habits have no streak concept (computeStreak
  // already returns 0 for them) so they're naturally excluded too.
  const habitStreaks = JSON.stringify(
    habits.filter((h) => h.streak > 0).map((h) => ({ name: h.habit.name, streak: h.streak }))
  );
  const cardioLogCount = cardioLogs.length;
  const cardioStreak = computeCardioStreak(cardioLogs);
  const cardioDistanceKm = cardioLogs.reduce((sum, log) => sum + (log.distanceKm ?? 0), 0);
  const workoutLogCount = workoutLogs.length;
  const meditationLogCount = meditationLogs.length;
  const breathingLogCount = breathingLogs.length;

  useEffect(() => {
    if (!myUid) return;
    setDoc(
      doc(firestore, 'userPublicProfiles', myUid),
      {
        habitStreak,
        habitStreaks,
        cardioLogCount,
        cardioStreak,
        cardioDistanceKm,
        workoutLogCount,
        mealLogCount,
        waterGoalHitDays,
        meditationLogCount,
        breathingLogCount,
      },
      { merge: true }
    ).catch(() => {});
  }, [
    myUid,
    habitStreak,
    habitStreaks,
    cardioLogCount,
    cardioStreak,
    cardioDistanceKm,
    workoutLogCount,
    mealLogCount,
    waterGoalHitDays,
    meditationLogCount,
    breathingLogCount,
  ]);
}
