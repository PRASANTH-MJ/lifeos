import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';

import type { FinancialGoal, HealthGoal } from './types';

export type Recommendation = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href: Href;
};

/** Turns the Goals step's selections into a short, concrete list of modules worth trying first —
 * the "based on that we give recommendations" step. Deliberately simple keyword-style mapping
 * (not a scoring model): each goal maps to the one or two modules most directly useful for it,
 * deduped by key so picking overlapping goals doesn't repeat the same card twice. */
export function getOnboardingRecommendations(healthGoal: HealthGoal | null, financialGoals: FinancialGoal[]): Recommendation[] {
  const recs = new Map<string, Recommendation>();
  const add = (r: Recommendation) => recs.set(r.key, r);

  switch (healthGoal) {
    case 'lose_weight':
      add({ key: 'food', icon: 'restaurant', title: 'Food Tracker', subtitle: 'Log meals and keep an eye on calories', href: '/food' });
      add({ key: 'cardio', icon: 'walk', title: 'Activity Tracker', subtitle: 'Running, walking, cycling — log a session and level up', href: '/cardio' });
      break;
    case 'gain_weight':
    case 'build_muscle':
      add({ key: 'workout', icon: 'barbell', title: 'Workout Tracker', subtitle: "Today's recommendation based on your goal", href: '/workout' });
      add({ key: 'food', icon: 'restaurant', title: 'Food Tracker', subtitle: 'Log meals and keep an eye on macros', href: '/food' });
      break;
    case 'maintain':
      add({ key: 'habits', icon: 'flame', title: 'Habits', subtitle: 'Keep your routines going with daily streaks', href: '/habits' });
      add({ key: 'water', icon: 'water', title: 'Water Tracker', subtitle: 'A daily goal suggested from your weight', href: '/water' });
      break;
  }

  if (financialGoals.includes('pay_off_debt')) {
    add({ key: 'debts', icon: 'hand-left-outline', title: 'Debts', subtitle: 'Track balances and plan your payoff', href: '/finance/debts' });
  }
  if (financialGoals.includes('save_more') || financialGoals.includes('emergency_fund')) {
    add({ key: 'goals', icon: 'flag-outline', title: 'Finance Goals', subtitle: 'Set a savings target and track progress', href: '/finance/goals' });
  }
  if (financialGoals.includes('invest') || financialGoals.length > 0) {
    add({ key: 'budgets', icon: 'bar-chart-outline', title: 'Budgets', subtitle: 'See where your money goes each month', href: '/finance/budgets' });
  }

  // A blank first run (everything skipped) still gets a couple of sensible starting points.
  if (recs.size === 0) {
    add({ key: 'habits', icon: 'flame', title: 'Habits', subtitle: 'Start a streak on something you want to stick to', href: '/habits' });
    add({ key: 'tasks', icon: 'checkbox', title: 'Tasks', subtitle: "Plan today's to-dos", href: '/tasks' });
  }

  return Array.from(recs.values());
}
