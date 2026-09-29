import * as XLSX from 'xlsx';

import type { Category } from '@/modules/categories';
import type { CreateHabitInput } from './useHabits';
import type { HabitFrequency, TrackingType } from './types';

export type ImportHabitsResult = {
  rows: CreateHabitInput[];
  total: number;
  skipped: number;
};

const DEFAULT_ICON = 'checkmark-circle-outline';
const WEEKDAY_ABBREVIATIONS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'monthly', 'periodic'];

function normalizeKeys(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
  }
  return normalized;
}

/** Parses a "Mon,Wed,Fri" (or "Monday, Wednesday") style column into 0=Sun..6=Sat day indices —
 * same convention as WEEKDAY_LABELS elsewhere in this module. Unrecognized tokens are dropped
 * rather than aborting the whole row, since a weekly habit with a partially-matched day set is
 * still more useful than skipping it entirely. */
function parseWeekdays(raw: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim().toLowerCase().slice(0, 3))
    .map((token) => WEEKDAY_ABBREVIATIONS.indexOf(token))
    .filter((day) => day >= 0);
}

/** Reads CSV/Excel text (from a file picked via expo-document-picker) and maps its rows onto
 * habit-creation inputs. Deliberately supports only the common yesno/numeric habit shapes a bulk
 * import realistically needs — a checklist or timer habit has enough extra structure (checklist
 * items, a target duration) that they're still meant to be built one at a time in the habit form. */
export function parseHabitsCsv(csvText: string, categories: Category[]): ImportHabitsResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: CreateHabitInput[] = [];
  let skipped = 0;

  for (const record of records) {
    const entry = normalizeKeys(record);
    const name = entry.name || entry.habit || entry.title;
    if (!name) {
      skipped += 1;
      continue;
    }

    const frequencyRaw = entry.frequency.toLowerCase() as HabitFrequency;
    const frequency: HabitFrequency = FREQUENCIES.includes(frequencyRaw) ? frequencyRaw : 'daily';
    const targetDays = frequency === 'weekly' ? parseWeekdays(entry.days || entry.weekdays) : [];

    const categoryName = (entry.category || '').toLowerCase();
    const category = categories.find((c) => c.name.toLowerCase() === categoryName) ?? null;

    const targetValue = entry.target ? Number(entry.target) : null;
    const trackingType: TrackingType = targetValue != null && !Number.isNaN(targetValue) ? 'numeric' : 'yesno';

    rows.push({
      name,
      icon: entry.icon || DEFAULT_ICON,
      categoryId: category ? category.id : null,
      trackingType,
      targetValue: trackingType === 'numeric' ? targetValue : null,
      targetUnit: trackingType === 'numeric' ? entry.unit || null : null,
      frequency,
      targetDays,
      routineGroup: entry.group || entry.routinegroup || null,
    });
  }

  return { rows, total: records.length, skipped };
}
