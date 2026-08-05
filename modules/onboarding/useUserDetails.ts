import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { onSyncMerge, pushLocalRow } from '@/modules/sync';
import type { FinancialGoal, HealthGoal, IncomeBracket, UserDetails, UserDetailsInput } from './types';

type Row = {
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  health_goal: HealthGoal | null;
  income_bracket: IncomeBracket | null;
  financial_goal: FinancialGoal | null;
  onboarding_done: number;
};

function toUserDetails(row: Row | null): UserDetails {
  return {
    dateOfBirth: row?.date_of_birth ?? null,
    heightCm: row?.height_cm ?? null,
    weightKg: row?.weight_kg ?? null,
    healthGoal: row?.health_goal ?? null,
    incomeBracket: row?.income_bracket ?? null,
    financialGoal: row?.financial_goal ?? null,
    onboardingDone: Boolean(row?.onboarding_done),
  };
}

export function useUserDetails() {
  const db = useSQLiteContext();
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<Row>(
      'SELECT date_of_birth, height_cm, weight_kg, health_goal, income_bracket, financial_goal, onboarding_done FROM user_details WHERE id = 1'
    );
    setDetails(toUserDetails(row));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // This hook's one consumer (app/_layout.tsx's RootNavigation, gating onboarding) is the root
  // layout — it mounts once and is never "focused" again the way a routed screen is, so a remote
  // onboarding_done pulled down from another device would otherwise sit correctly in SQLite but
  // never reach this hook's state for the rest of the session. Subscribe directly instead.
  useEffect(() => {
    return onSyncMerge((tables) => {
      if (tables.has('user_details')) refresh();
    });
  }, [refresh]);

  const save = useCallback(
    async (input: UserDetailsInput, markOnboardingDone = true) => {
      await db.runAsync(
        `UPDATE user_details SET
           date_of_birth = COALESCE(?, date_of_birth),
           height_cm = COALESCE(?, height_cm),
           weight_kg = COALESCE(?, weight_kg),
           health_goal = COALESCE(?, health_goal),
           income_bracket = COALESCE(?, income_bracket),
           financial_goal = COALESCE(?, financial_goal),
           onboarding_done = ?,
           updated_at = ?
         WHERE id = 1`,
        [
          input.dateOfBirth ?? null,
          input.heightCm ?? null,
          input.weightKg ?? null,
          input.healthGoal ?? null,
          input.incomeBracket ?? null,
          input.financialGoal ?? null,
          markOnboardingDone ? 1 : 0,
          new Date().toISOString(),
        ]
      );
      await pushLocalRow(db, 'user_details', 1);
      await refresh();
    },
    [db, refresh]
  );

  const skipOnboarding = useCallback(async () => {
    await db.runAsync('UPDATE user_details SET onboarding_done = 1, updated_at = ? WHERE id = 1', [new Date().toISOString()]);
    await pushLocalRow(db, 'user_details', 1);
    await refresh();
  }, [db, refresh]);

  return { details, loading, save, skipOnboarding };
}
