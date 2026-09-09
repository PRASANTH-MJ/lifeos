import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { onSyncMerge, pushLocalRow } from '@/modules/sync';
import type { FoodStyle, HealthGoal, IncomeBracket, UserDetails, UserDetailsInput } from './types';
import { parseFinancialGoals } from './types';

type Row = {
  phone_number: string | null;
  date_of_birth: string | null;
  country: string | null;
  state: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  avg_sleep_time: string | null;
  avg_wake_time: string | null;
  avg_water_intake_ml: number | null;
  food_style: FoodStyle | null;
  health_goal: HealthGoal | null;
  income_bracket: IncomeBracket | null;
  financial_goals: string | null;
  onboarding_done: number;
};

function toUserDetails(row: Row | null): UserDetails {
  return {
    phoneNumber: row?.phone_number ?? null,
    dateOfBirth: row?.date_of_birth ?? null,
    country: row?.country ?? null,
    state: row?.state ?? null,
    heightCm: row?.height_cm ?? null,
    weightKg: row?.weight_kg ?? null,
    avgSleepTime: row?.avg_sleep_time ?? null,
    avgWakeTime: row?.avg_wake_time ?? null,
    avgWaterIntakeMl: row?.avg_water_intake_ml ?? null,
    foodStyle: row?.food_style ?? null,
    healthGoal: row?.health_goal ?? null,
    incomeBracket: row?.income_bracket ?? null,
    financialGoals: parseFinancialGoals(row?.financial_goals),
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
      `SELECT phone_number, date_of_birth, country, state, height_cm, weight_kg, avg_sleep_time, avg_wake_time,
              avg_water_intake_ml, food_style, health_goal, income_bracket, financial_goals, onboarding_done
       FROM user_details WHERE id = 1`
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
           phone_number = COALESCE(?, phone_number),
           date_of_birth = COALESCE(?, date_of_birth),
           country = COALESCE(?, country),
           state = COALESCE(?, state),
           height_cm = COALESCE(?, height_cm),
           weight_kg = COALESCE(?, weight_kg),
           avg_sleep_time = COALESCE(?, avg_sleep_time),
           avg_wake_time = COALESCE(?, avg_wake_time),
           avg_water_intake_ml = COALESCE(?, avg_water_intake_ml),
           food_style = COALESCE(?, food_style),
           health_goal = COALESCE(?, health_goal),
           income_bracket = COALESCE(?, income_bracket),
           financial_goals = COALESCE(?, financial_goals),
           onboarding_done = ?,
           updated_at = ?
         WHERE id = 1`,
        [
          input.phoneNumber ?? null,
          input.dateOfBirth ?? null,
          input.country ?? null,
          input.state ?? null,
          input.heightCm ?? null,
          input.weightKg ?? null,
          input.avgSleepTime ?? null,
          input.avgWakeTime ?? null,
          input.avgWaterIntakeMl ?? null,
          input.foodStyle ?? null,
          input.healthGoal ?? null,
          input.incomeBracket ?? null,
          input.financialGoals ? JSON.stringify(input.financialGoals) : null,
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
