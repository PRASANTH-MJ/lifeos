import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { computeDailyStreak } from '@/lib/dailyStreak';
import { toDateKey } from '@/lib/date';

type LogRow = { completed_at: string };

/** Consecutive-day streak ending today, counting a day if either meditation or breathing was
 * logged — the two screens are separate entry points into the same underlying habit.
 *
 * Web build of useMindfulnessStreak.ts — same return shape (a plain number), but reactive via
 * Dexie's useLiveQuery instead of expo-router's useFocusEffect: a write to either table from any
 * tab (or the sync engine) recomputes the streak everywhere automatically. */
export function useMindfulnessStreak() {
  const streak = useLiveQuery(async () => {
    const [meditation, breathing] = await Promise.all([
      webDb.meditation_logs.toArray() as unknown as Promise<LogRow[]>,
      webDb.breathing_logs.toArray() as unknown as Promise<LogRow[]>,
    ]);
    const dateKeys = [...meditation, ...breathing].map((row) => toDateKey(new Date(row.completed_at)));
    return computeDailyStreak(dateKeys);
  }, []);

  return streak ?? 0;
}
