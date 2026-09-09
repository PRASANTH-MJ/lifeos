import type { HabitFrequency, TargetComparator, TrackingType } from './types';

export type HabitTemplate = {
  key: string;
  name: string;
  icon: string;
  description: string;
  trackingType: TrackingType;
  frequency: HabitFrequency;
  targetValue?: number;
  targetUnit?: string;
  targetComparator?: TargetComparator;
  /** Only meaningful when frequency === 'weekly' — weekdays (0=Sun..6=Sat), same encoding as
   * habits.target_days. */
  targetDays?: number[];
};

/** A small fixed starter set for "Browse templates" on the new-habit flow — tapping one only
 * prefills HabitForm's fields (see its `template` prop), it never saves anything on its own. Kept
 * as plain data (no icon restricted to HABIT_ICONS) since HabitForm/IconBadge render any Ionicons
 * glyph name, not just the curated icon-picker set. */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    key: 'drink-water',
    name: 'Drink more water',
    icon: 'water-outline',
    description: 'Stay hydrated every day',
    trackingType: 'numeric',
    frequency: 'daily',
    targetValue: 8,
    targetUnit: 'glasses',
    targetComparator: 'at_least',
  },
  {
    key: 'read-10',
    name: 'Read 10 minutes',
    icon: 'book-outline',
    description: 'A few pages a day adds up',
    trackingType: 'timer',
    frequency: 'daily',
    targetValue: 10,
    targetComparator: 'at_least',
  },
  {
    key: 'no-phone-before-bed',
    name: 'No phone before bed',
    icon: 'moon-outline',
    description: 'Wind down without a screen',
    trackingType: 'yesno',
    frequency: 'daily',
  },
  {
    key: 'morning-stretch',
    name: 'Morning stretch',
    icon: 'sunny-outline',
    description: 'Loosen up right after waking',
    trackingType: 'yesno',
    frequency: 'daily',
  },
  {
    key: 'gratitude-journal',
    name: 'Gratitude journal',
    icon: 'leaf-outline',
    description: 'Write down one thing you’re grateful for',
    trackingType: 'yesno',
    frequency: 'daily',
  },
  {
    key: 'cold-shower',
    name: 'Cold shower',
    icon: 'snow-outline',
    description: 'Start the day with a cold burst',
    trackingType: 'yesno',
    frequency: 'daily',
  },
  {
    key: 'meal-prep-sunday',
    name: 'Meal prep Sunday',
    icon: 'restaurant-outline',
    description: 'Prep meals once a week',
    trackingType: 'yesno',
    frequency: 'weekly',
    targetDays: [0],
  },
  {
    key: 'daily-walk',
    name: 'Daily walk',
    icon: 'walk-outline',
    description: 'Get your steps in',
    trackingType: 'numeric',
    frequency: 'daily',
    targetValue: 30,
    targetUnit: 'minutes',
    targetComparator: 'at_least',
  },
];
