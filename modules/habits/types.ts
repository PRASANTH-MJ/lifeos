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
  /** JSON string array of "HH:MM" (24-hour) times — fires a daily reminder at each configured
   * time regardless of which days the habit is actually due (a known simplification). Use
   * `parseReminderTimes` to read this. Null/empty means no reminder. */
  reminder_time: string | null;
  alarm_enabled: number;
  sort_order: number;
  created_at: string;
  archived: number;
  /** Free-text grouping label for the Habits list ("Morning routine", "Evening routine", ...) —
   * user-typed, not a fixed enum, so any name they reuse across habits groups them together. Null
   * means ungrouped (rendered outside any section, same as before this existed). */
  routine_group: string | null;
  /** Every synced table has had this since db/schema.ts's v23 migration — not previously part of
   * this type since nothing here needed it directly; habit_chains' habit_sync_ids does. */
  sync_id: string | null;
};

export type HabitChain = {
  id: number;
  name: string;
  /** JSON string array of the member habits' `sync_id`s, in the order they're done — see
   * db/schema.ts's v59 migration comment for why sync_id rather than local id. */
  habit_sync_ids: string;
  sync_id: string | null;
  created_at: string;
  updated_at: string;
};

export function parseChainHabitSyncIds(habitSyncIds: string): string[] {
  try {
    const parsed = JSON.parse(habitSyncIds);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export type ChainHabitEntry = { habit: Habit; missing: false } | { habit: null; missing: true; syncId: string };

/** Resolves a chain's `habit_sync_ids` against the currently-loaded `habits` list — a member
 * habit deleted since the chain was built simply can't be resolved (`missing: true`) rather than
 * crashing the chain view; the chain itself is never auto-edited to drop it. */
export function resolveChainHabits(chain: HabitChain, habitsBySyncId: Map<string, Habit>): ChainHabitEntry[] {
  return parseChainHabitSyncIds(chain.habit_sync_ids).map((syncId) => {
    const habit = habitsBySyncId.get(syncId);
    return habit ? { habit, missing: false } : { habit: null, missing: true, syncId };
  });
}

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

/** Parses `habits.reminder_time`'s JSON array-of-"HH:MM" format. Returns `[]` for null/empty/
 * malformed values — including a pre-migration plain "HH:MM" string, which should never reach
 * here (the v38 migration wraps every existing value into a one-element array), but falling back
 * to "no reminder" rather than throwing is safer than crashing the habit list over stale data. */
export function parseReminderTimes(reminderTime: string | null): string[] {
  if (!reminderTime) return [];
  try {
    const parsed = JSON.parse(reminderTime);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
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
