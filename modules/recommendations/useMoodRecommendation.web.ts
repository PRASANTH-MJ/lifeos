import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { bucketForMood, MOOD_RECOMMENDATIONS, type MoodBucket } from './moodContent';

export type MoodKey = 'great' | 'good' | 'okay' | 'low' | 'rough';

type EntryRow = { mood: string | null; created_at: string };
type CheckinRow = { mood: string | null; stress: number | null; energy: number | null; created_at: string };

/** Web build of useMoodRecommendation.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a journal entry or check-in written in
 * any tab (or applied by the sync engine) re-computes the recommendation in every mounted
 * instance automatically, so no manual refresh()/focus-triggered re-read is needed. */
export function useMoodRecommendation() {
  const signal = useLiveQuery(async () => {
    const [entries, checkins] = await Promise.all([
      webDb.journal_entries.toArray() as unknown as Promise<EntryRow[]>,
      webDb.journal_checkins.toArray() as unknown as Promise<CheckinRow[]>,
    ]);

    const entryRow =
      entries
        .filter((r) => r.mood !== null && r.mood !== undefined)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    const checkinRow = [...checkins].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    return { entryRow, checkinRow };
  }, []);

  const loading = signal === undefined;
  const entryRow = signal?.entryRow ?? null;
  const checkinRow = signal?.checkinRow ?? null;

  const checkinSignal = checkinRow ? { stress: checkinRow.stress, energy: checkinRow.energy } : null;

  const candidates = [entryRow, checkinRow].filter(
    (r): r is { mood: string; created_at: string } => Boolean(r?.mood)
  );
  candidates.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const mood = (candidates[0]?.mood as MoodKey | undefined) ?? null;

  let bucket: MoodBucket | null = mood ? bucketForMood(mood) : null;
  // High stress or very low energy from the latest check-in overrides a neutral/good mood bucket
  // toward calming content — the more actionable signal wins.
  if (bucket && bucket !== 'rough' && checkinSignal) {
    if ((checkinSignal.stress ?? 0) >= 4 || (checkinSignal.energy !== null && checkinSignal.energy <= 2)) {
      bucket = 'rough';
    }
  }

  const recommendation = bucket ? MOOD_RECOMMENDATIONS[bucket] : null;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab. Kept so
    // ported callers that do `await refresh()` don't need changing.
  }, []);

  return { mood, recommendation, loading, refresh };
}
