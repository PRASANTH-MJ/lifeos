export type HealthGoal = 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
export type IncomeBracket = 'under_25k' | '25k_50k' | '50k_1l' | '1l_plus';
export type FinancialGoal = 'save_more' | 'pay_off_debt' | 'invest' | 'emergency_fund' | 'other';
export type FoodStyle = 'vegetarian' | 'non_vegetarian' | 'vegan' | 'eggetarian' | 'other';

export const FOOD_STYLE_LABELS: Record<FoodStyle, string> = {
  vegetarian: 'Vegetarian',
  non_vegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
  eggetarian: 'Eggetarian',
  other: 'Other',
};

export const HEALTH_GOAL_LABELS: Record<HealthGoal, string> = {
  lose_weight: 'Lose weight',
  maintain: 'Maintain',
  gain_weight: 'Gain weight',
  build_muscle: 'Build muscle',
};

export const INCOME_BRACKET_LABELS: Record<IncomeBracket, string> = {
  under_25k: 'Under ₹25k/mo',
  '25k_50k': '₹25k–₹50k/mo',
  '50k_1l': '₹50k–₹1L/mo',
  '1l_plus': '₹1L+/mo',
};

export const FINANCIAL_GOAL_LABELS: Record<FinancialGoal, string> = {
  save_more: 'Save more',
  pay_off_debt: 'Pay off debt',
  invest: 'Invest',
  emergency_fund: 'Build an emergency fund',
  other: 'Other',
};

/** Financial goal is multi-select (unlike health goal), so it's stored as a JSON-encoded array in
 * a single TEXT column — same convention as habits.target_days and module_reminders.schedule_days
 * (see db/schema.ts). Falls back to an empty list for null/blank/corrupt values. */
export function parseFinancialGoals(value: string | null | undefined): FinancialGoal[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Maps onboarding's HealthGoal to the `goal` tag used by workout programs and meal plans
 * (modules/workout/usePrograms.ts, modules/food/useMealPlans.ts) — 'gain_weight' and
 * 'build_muscle' both point at 'muscle-building' since the training/eating approach is the same
 * for both; only exact calorie target differs, which is out of scope for a tag match. */
export function healthGoalToContentGoal(goal: HealthGoal | null): string {
  switch (goal) {
    case 'lose_weight':
      return 'weight-loss';
    case 'gain_weight':
    case 'build_muscle':
      return 'muscle-building';
    default:
      return 'general';
  }
}

export type UserDetails = {
  phoneNumber: string | null;
  dateOfBirth: string | null;
  country: string | null;
  state: string | null;
  heightCm: number | null;
  weightKg: number | null;
  avgSleepTime: string | null;
  avgWakeTime: string | null;
  avgWaterIntakeMl: number | null;
  foodStyle: FoodStyle | null;
  healthGoal: HealthGoal | null;
  incomeBracket: IncomeBracket | null;
  financialGoals: FinancialGoal[];
  onboardingDone: boolean;
};

export type UserDetailsInput = Partial<
  Pick<
    UserDetails,
    | 'phoneNumber'
    | 'dateOfBirth'
    | 'country'
    | 'state'
    | 'heightCm'
    | 'weightKg'
    | 'avgSleepTime'
    | 'avgWakeTime'
    | 'avgWaterIntakeMl'
    | 'foodStyle'
    | 'healthGoal'
    | 'incomeBracket'
    | 'financialGoals'
  >
>;
