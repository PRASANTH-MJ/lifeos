import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { bucketForMood, MOOD_RECOMMENDATIONS, type MoodBucket } from './moodContent';

export type MoodKey = 'great' | 'good' | 'okay' | 'low' | 'rough';

/** Looks at whichever of the two mood sources (a journal entry or a check-in) was most recently
 * saved, and recommends a breathing pattern, meditation session, mind-training exercise, and
 * affirmation to match — a small rule-based mapping (see moodContent.ts), not a trained model, but
 * genuinely responsive to how the user says they're actually feeling rather than generic.
 *
 * The latest check-in's stress/energy (1-5 scales, not just its mood label) can additionally push
 * the bucket toward "rough" even if the mood label alone read as neutral — someone can log "okay"
 * mood while also logging high stress, and the stress is the more actionable signal there. */
export function useMoodRecommendation() {
  const db = useSQLiteContext();
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [checkinSignal, setCheckinSignal] = useState<{ stress: number | null; energy: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [entryRow, checkinRow] = await Promise.all([
        db.getFirstAsync<{ mood: string | null; created_at: string }>(
          "SELECT mood, created_at FROM journal_entries WHERE mood IS NOT NULL ORDER BY created_at DESC LIMIT 1"
        ),
        db.getFirstAsync<{ mood: string | null; stress: number | null; energy: number | null; created_at: string }>(
          'SELECT mood, stress, energy, created_at FROM journal_checkins ORDER BY created_at DESC LIMIT 1'
        ),
      ]);

      setCheckinSignal(checkinRow ? { stress: checkinRow.stress, energy: checkinRow.energy } : null);

      const candidates = [entryRow, checkinRow].filter((r): r is { mood: string; created_at: string } => Boolean(r?.mood));
      candidates.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setMood((candidates[0]?.mood as MoodKey | undefined) ?? null);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  let bucket: MoodBucket | null = mood ? bucketForMood(mood) : null;
  // High stress or very low energy from the latest check-in overrides a neutral/good mood bucket
  // toward calming content — the more actionable signal wins.
  if (bucket && bucket !== 'rough' && checkinSignal) {
    if ((checkinSignal.stress ?? 0) >= 4 || (checkinSignal.energy !== null && checkinSignal.energy <= 2)) {
      bucket = 'rough';
    }
  }

  const recommendation = bucket ? MOOD_RECOMMENDATIONS[bucket] : null;

  return { mood, recommendation, loading, refresh };
}
