import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { useProfile } from '@/modules/profile';

// Deliberately thin — the 14-day trial (see usePremium.ts/startTrialIfEligible) is the "try
// everything" hook, this is what's left afterward for someone who doesn't convert. Sized to stay
// just usable enough that existing data/streaks remain worth keeping (so the app doesn't get
// uninstalled outright, which would cost the org rating/ranking, not just revenue), while making
// any actually-active user hit a cap fast. Not a step down from a generous default — this IS the
// default; the trial is the generous part.
export const FREE_LIMITS = {
  habits: 1,
  recurringTasks: 0,
  financeAccounts: 0,
  // Free transactions reset every calendar month (see COUNT_QUERIES below) rather than being a
  // lifetime cap — a one-time cap would permanently block the finance module after a couple of
  // months of normal use, whereas a monthly allowance keeps the module usable indefinitely while
  // still making a genuinely active tracker want unlimited.
  financeTransactions: 5,
  tasks: 2,
  journalEntries: 3,
  customWorkouts: 0,
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

const COUNT_QUERIES: Record<LimitKind, string> = {
  habits: 'SELECT COUNT(*) as count FROM habits WHERE archived = 0',
  recurringTasks: 'SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND is_recurring = 1',
  financeAccounts: 'SELECT COUNT(*) as count FROM finance_accounts WHERE is_archived = 0',
  // Counts by created_at (when the row was actually added), not the user-editable `date` field —
  // otherwise backdating a transaction's date would let a free user dodge the monthly cap.
  financeTransactions: "SELECT COUNT(*) as count FROM finance_transactions WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
  // Only *active* (not yet completed) single tasks count — tasks naturally pile up as
  // completed history, and gating on that would fill the free cap permanently after a few
  // weeks of normal use, unlike habits/accounts which represent ongoing commitments.
  tasks: "SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND is_recurring = 0 AND completed_at IS NULL",
  // Journal entries have no "completed" state — they're a permanent diary, so the cap is
  // cumulative (total ever written), matching how most journaling apps meter free tiers.
  journalEntries: 'SELECT COUNT(*) as count FROM journal_entries',
  customWorkouts: 'SELECT COUNT(*) as count FROM custom_workouts',
};

/** Checks a free-tier cap against what's already in SQLite — only ever gates *creating new*
 * items; anything a user already has (even over the cap, e.g. from before they downgraded)
 * stays fully visible and usable. Premium accounts always pass. */
export function useFreeTierGate(kind: LimitKind) {
  const db = useSQLiteContext();
  const { profile } = useProfile();
  const [current, setCurrent] = useState(0);

  const refresh = useCallback(async () => {
    const row = await db.getFirstAsync<{ count: number }>(COUNT_QUERIES[kind]);
    setCurrent(row?.count ?? 0);
  }, [db, kind]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const limit = FREE_LIMITS[kind];
  const premium = profile?.premium ?? false;

  return { allowed: premium || current < limit, current, limit, premium, refresh };
}
