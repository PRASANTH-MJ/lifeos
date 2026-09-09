import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
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

function toUserDetails(row: Row | null | undefined): UserDetails {
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

/**
 * Web build of useUserDetails.ts — same exported shape. Reactive via useLiveQuery, which also
 * solves the native version's specific problem of needing a manual onSyncMerge subscription
 * (this hook's one consumer, the root layout, never re-focuses) — a live query re-runs on any
 * underlying write regardless of focus, including one applied by syncEngine.web.ts's merge.
 */
export function useUserDetails() {
  const row = useLiveQuery(() => webDb.user_details.get(1) as Promise<Row | undefined>, []);
  const loading = row === undefined;
  const details = toUserDetails(row);

  const save = useCallback(async (input: UserDetailsInput, markOnboardingDone = true) => {
    const current = await webDb.user_details.get(1);
    await webDb.user_details.update(1, {
      phone_number: input.phoneNumber ?? current?.phone_number ?? null,
      date_of_birth: input.dateOfBirth ?? current?.date_of_birth ?? null,
      country: input.country ?? current?.country ?? null,
      state: input.state ?? current?.state ?? null,
      height_cm: input.heightCm ?? current?.height_cm ?? null,
      weight_kg: input.weightKg ?? current?.weight_kg ?? null,
      avg_sleep_time: input.avgSleepTime ?? current?.avg_sleep_time ?? null,
      avg_wake_time: input.avgWakeTime ?? current?.avg_wake_time ?? null,
      avg_water_intake_ml: input.avgWaterIntakeMl ?? current?.avg_water_intake_ml ?? null,
      food_style: input.foodStyle ?? current?.food_style ?? null,
      health_goal: input.healthGoal ?? current?.health_goal ?? null,
      income_bracket: input.incomeBracket ?? current?.income_bracket ?? null,
      financial_goals: input.financialGoals ? JSON.stringify(input.financialGoals) : current?.financial_goals ?? null,
      onboarding_done: markOnboardingDone ? 1 : 0,
      updated_at: new Date().toISOString(),
    });
    await pushLocalRow('user_details', 1);
  }, []);

  const skipOnboarding = useCallback(async () => {
    await webDb.user_details.update(1, { onboarding_done: 1, updated_at: new Date().toISOString() });
    await pushLocalRow('user_details', 1);
  }, []);

  return { details, loading, save, skipOnboarding };
}
