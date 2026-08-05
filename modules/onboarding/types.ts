export type HealthGoal = 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
export type IncomeBracket = 'under_25k' | '25k_50k' | '50k_1l' | '1l_plus';
export type FinancialGoal = 'save_more' | 'pay_off_debt' | 'invest' | 'emergency_fund' | 'other';

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

export type UserDetails = {
  phoneNumber: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  healthGoal: HealthGoal | null;
  incomeBracket: IncomeBracket | null;
  financialGoal: FinancialGoal | null;
  onboardingDone: boolean;
};

export type UserDetailsInput = Partial<
  Pick<UserDetails, 'phoneNumber' | 'dateOfBirth' | 'heightCm' | 'weightKg' | 'healthGoal' | 'incomeBracket' | 'financialGoal'>
>;
