export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'periodic';
export type TrackingType = 'yesno' | 'numeric' | 'timer' | 'checklist';
export type TargetComparator = 'at_least' | 'at_most' | 'exactly';
export type LogStatus = 'done' | 'fail' | 'skip';

export type Habit = {
  id: number;
  name: string;
  icon: string;
  category_id: number | null;
  tracking_type: TrackingType;
  target_value: number | null;
  target_unit: string | null;
  target_comparator: TargetComparator;
  checklist_items: string;
  checklist_success_mode: 'all' | 'custom';
  checklist_min_count: number;
  frequency: HabitFrequency;
  /** JSON number[]: weekdays (0=Sun..6=Sat) for 'weekly', days-of-month (1-31) for 'monthly'. */
  target_days: string;
  period_target_count: number | null;
  period_length_days: number | null;
  /** "HH:MM", 24-hour — fires a daily reminder at this time regardless of
   * which days the habit is actually due (a known simplification). */
  reminder_time: string | null;
  alarm_enabled: number;
  sort_order: number;
  created_at: string;
  archived: number;
};

export type HabitLog = {
  id: number;
  habit_id: number;
  date: string;
  status: LogStatus;
  value: number | null;
  checklist_checked: string | null;
  note: string | null;
  completed_at: string;
};

export function parseTargetDays(targetDays: string): number[] {
  try {
    const parsed = JSON.parse(targetDays);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseChecklistItems(checklistItems: string): string[] {
  try {
    const parsed = JSON.parse(checklistItems);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseChecklistChecked(checklistChecked: string | null): number[] {
  if (!checklistChecked) return [];
  try {
    const parsed = JSON.parse(checklistChecked);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const HABIT_ICONS = [
  'checkmark-circle',
  'water',
  'book',
  'barbell',
  'moon',
  'walk',
  'nutrition',
  'leaf',
  'bed',
  'bicycle',
] as const;

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

export const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  yesno: 'Yes or no',
  numeric: 'Numeric value',
  timer: 'Timer',
  checklist: 'Checklist',
};

export const FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  daily: 'Every day',
  weekly: 'Specific days of the week',
  monthly: 'Specific days of the month',
  periodic: 'Some days per period',
};

export const COMPARATOR_LABELS: Record<TargetComparator, string> = {
  at_least: 'At least',
  at_most: 'At most',
  exactly: 'Exactly',
};
