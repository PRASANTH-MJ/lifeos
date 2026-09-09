import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { useProfile } from '@/modules/profile';

export const FREE_LIMITS = {
  habits: 5,
  recurringTasks: 2,
  financeAccounts: 1,
  // Resets every calendar month — see limits.ts's identical constant for why this is monthly
  // rather than a lifetime cap.
  financeTransactions: 30,
  tasks: 10,
  journalEntries: 15,
  customWorkouts: 2,
} as const;

export type LimitKind = keyof typeof FREE_LIMITS;

export const LIMIT_LABELS: Record<LimitKind, string> = {
  habits: 'habits',
  recurringTasks: 'recurring tasks',
  financeAccounts: 'finance accounts',
  financeTransactions: 'transactions this month',
  tasks: 'active tasks',
  journalEntries: 'journal entries',
  customWorkouts: 'custom workouts',
};

// Translations of COUNT_QUERIES from limits.ts's SQL strings into JS predicates run against
// each table's full array (these tables are small — personal life-tracking data).
const COUNTERS: Record<LimitKind, () => Promise<number>> = {
  habits: async () =>
    (await webDb.habits.toArray()).filter((r) => !r.archived).length,
  recurringTasks: async () =>
    (await webDb.tasks.toArray()).filter((r) => !r.archived && r.is_recurring === 1).length,
  financeAccounts: async () =>
    (await webDb.finance_accounts.toArray()).filter((r) => !r.is_archived).length,
  // Counts by created_at (when the row was actually added), not the user-editable `date` field —
  // otherwise backdating a transaction's date would let a free user dodge the monthly cap.
  financeTransactions: async () => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return (await webDb.finance_transactions.toArray()).filter((r) => typeof r.created_at === 'string' && r.created_at.slice(0, 7) === thisMonth)
      .length;
  },
  // Only *active* (not yet completed) single tasks count — tasks naturally pile up as
  // completed history, and gating on that would fill the free cap permanently after a few
  // weeks of normal use, unlike habits/accounts which represent ongoing commitments.
  tasks: async () =>
    (await webDb.tasks.toArray()).filter(
      (r) => !r.archived && r.is_recurring !== 1 && (r.completed_at === null || r.completed_at === undefined)
    ).length,
  // Journal entries have no "completed" state — they're a permanent diary, so the cap is
  // cumulative (total ever written), matching how most journaling apps meter free tiers.
  journalEntries: async () => webDb.journal_entries.count(),
  customWorkouts: async () => webDb.custom_workouts.count(),
};

/** Checks a free-tier cap against what's already in IndexedDB — only ever gates *creating new*
 * items; anything a user already has (even over the cap, e.g. from before they downgraded)
 * stays fully visible and usable. Premium accounts always pass.
 *
 * Reactive via Dexie's useLiveQuery instead of expo-router's useFocusEffect: a write from any
 * tab (creating/archiving a habit, completing a task, etc.) recomputes `current` automatically
 * everywhere, so `refresh` is kept only as a same-shape no-op for callers that invoke it. */
export function useFreeTierGate(kind: LimitKind) {
  const { profile } = useProfile();

  const current = useLiveQuery(() => COUNTERS[kind](), [kind]) ?? 0;

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  const limit = FREE_LIMITS[kind];
  const premium = profile?.premium ?? false;

  return { allowed: premium || current < limit, current, limit, premium, refresh };
}
