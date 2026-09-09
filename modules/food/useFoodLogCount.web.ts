import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';

/** Web build of useFoodLogCount.ts — same return shape (a plain number), reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect. */
export function useFoodLogCount() {
  const count = useLiveQuery(async () => (await webDb.food_logs.toArray()).length, []);
  return count ?? 0;
}
