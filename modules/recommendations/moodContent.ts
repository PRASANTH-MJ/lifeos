import type { MoodKey } from './useMoodRecommendation';

export type MoodBucket = 'rough' | 'steady' | 'good';

const BUCKET_BY_MOOD: Record<MoodKey, MoodBucket> = {
  rough: 'rough',
  low: 'rough',
  okay: 'steady',
  good: 'good',
  great: 'good',
};

export function bucketForMood(mood: MoodKey): MoodBucket {
  return BUCKET_BY_MOOD[mood] ?? 'steady';
}

type MoodRecommendation = {
  message: string;
  breathingPatternKey: string;
  meditationSessionKey: string;
  mindExerciseKey: string | null;
  affirmation: string;
};

export type HealthGoalKey = 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';

type GoalTip = { foodTip: string; exerciseCategory: string | null };

export const GOAL_TIPS: Record<HealthGoalKey, GoalTip> = {
  lose_weight: {
    foodTip: 'Focus on high-volume, lower-calorie foods — vegetables and lean protein keep you fuller for less.',
    exerciseCategory: 'Cardio',
  },
  maintain: {
    foodTip: 'Keep meals balanced across protein, carbs, and fat.',
    exerciseCategory: null,
  },
  gain_weight: {
    foodTip: 'Add extra calories with nutrient-dense foods — nuts, dairy, and whole grains work well.',
    exerciseCategory: 'Chest',
  },
  build_muscle: {
    foodTip: 'Prioritize protein at each meal to support muscle repair and growth.',
    exerciseCategory: 'Back',
  },
};

/** Which WorkoutGoal best serves each health goal — used to bias the recommended workout pick
 * toward something that actually matches what the person is trying to achieve. */
export const HEALTH_GOAL_TO_WORKOUT_GOAL: Record<HealthGoalKey, 'general' | 'strength' | 'cardio' | 'flexibility'> = {
  lose_weight: 'cardio',
  maintain: 'general',
  gain_weight: 'strength',
  build_muscle: 'strength',
};

export type FinancialGoalKey = 'save_more' | 'pay_off_debt' | 'invest' | 'emergency_fund' | 'other';

type FinanceTip = { tip: string; link: '/finance/goals' | '/finance/debts' | '/finance/budgets' | '/finance' };

export const FINANCE_GOAL_TIPS: Record<FinancialGoalKey, FinanceTip> = {
  save_more: { tip: 'Set up a savings goal and add a small contribution today.', link: '/finance/goals' },
  pay_off_debt: { tip: 'Log any debt payments to track your progress toward being debt-free.', link: '/finance/debts' },
  invest: { tip: 'Consider setting a monthly budget for investing, even a small fixed amount.', link: '/finance/budgets' },
  emergency_fund: { tip: 'Aim for 3-6 months of expenses saved — track it as a goal.', link: '/finance/goals' },
  other: { tip: 'Check in on your budgets to stay on track with your financial goal.', link: '/finance' },
};

export const MOOD_RECOMMENDATIONS: Record<MoodBucket, MoodRecommendation> = {
  rough: {
    message: "Rough day — let's slow things down.",
    breathingPatternKey: '4-7-8',
    meditationSessionKey: 'deep-rest',
    mindExerciseKey: null,
    affirmation: 'This feeling is temporary, and I am allowed to rest without earning it.',
  },
  steady: {
    message: "Let's find some steady focus.",
    breathingPatternKey: 'box',
    meditationSessionKey: 'calm-focus',
    mindExerciseKey: 'go-no-go',
    affirmation: 'Small steps still move me forward.',
  },
  good: {
    message: 'Good energy — a great time to build on it.',
    breathingPatternKey: 'coherent',
    meditationSessionKey: 'morning-clarity',
    mindExerciseKey: 'reaction',
    affirmation: 'I am open to good things happening, and I am proud of how far I have come.',
  },
};
