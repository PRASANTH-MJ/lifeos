import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { useProfile } from '@/modules/profile';

export const FREE_LIMITS = {
  habits: 5,
  recurringTasks: 2,
  financeAccounts: 1,
} as const;

export type LimitKind = keyof typeof FREE_LIMITS;

export const LIMIT_LABELS: Record<LimitKind, string> = {
  habits: 'habits',
  recurringTasks: 'recurring tasks',
  financeAccounts: 'finance accounts',
};

const COUNT_QUERIES: Record<LimitKind, string> = {
  habits: 'SELECT COUNT(*) as count FROM habits WHERE archived = 0',
  recurringTasks: 'SELECT COUNT(*) as count FROM tasks WHERE archived = 0 AND is_recurring = 1',
  financeAccounts: 'SELECT COUNT(*) as count FROM finance_accounts WHERE is_archived = 0',
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
