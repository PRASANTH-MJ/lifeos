import * as XLSX from 'xlsx';

import type { Category } from '@/modules/categories';
import { toDateKey } from '@/lib/date';
import type { CreateTaskInput } from './useTasks';
import type { CreateRecurringTaskInput } from './useRecurringTasks';
import type { RecurrenceFrequency, TaskPriority } from './types';

export type ImportTasksResult = {
  /** One-off tasks (no `recurring`/`frequency` column, or an explicit "no") — created via
   * useTasks' createTask. */
  oneOffRows: CreateTaskInput[];
  /** Recurring tasks (an explicit "yes"/"true", or any recognized `frequency` value) — created via
   * useRecurringTasks' createRecurringTask. */
  recurringRows: CreateRecurringTaskInput[];
  total: number;
  skipped: number;
};

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'periodic'];
const WEEKDAY_ABBREVIATIONS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TRUTHY = ['yes', 'y', 'true', '1'];

function normalizeKeys(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
  }
  return normalized;
}

/** Parses a "Mon,Wed,Fri" style column into 0=Sun..6=Sat day indices — same convention as
 * WEEKDAY_LABELS elsewhere. Unrecognized tokens are dropped rather than aborting the row. */
function parseWeekdays(raw: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim().toLowerCase().slice(0, 3))
    .map((token) => WEEKDAY_ABBREVIATIONS.indexOf(token))
    .filter((day) => day >= 0);
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

/** Reads CSV/Excel text and maps its rows onto either one-off or recurring task-creation inputs,
 * split by row (a single import file can contain a mix of both, told apart by the `recurring`/
 * `frequency` columns) — see the two hooks each half is created through. */
export function parseTasksCsv(csvText: string, categories: Category[]): ImportTasksResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const oneOffRows: CreateTaskInput[] = [];
  const recurringRows: CreateRecurringTaskInput[] = [];
  let skipped = 0;

  for (const record of records) {
    const entry = normalizeKeys(record);
    const title = entry.title || entry.task;
    if (!title) {
      skipped += 1;
      continue;
    }

    const priorityRaw = entry.priority.toLowerCase() as TaskPriority;
    const priority: TaskPriority = PRIORITIES.includes(priorityRaw) ? priorityRaw : 'medium';
    const categoryName = (entry.category || '').toLowerCase();
    const category = categories.find((c) => c.name.toLowerCase() === categoryName) ?? null;
    const notes = entry.notes || entry.description || undefined;

    const frequencyRaw = entry.frequency.toLowerCase() as RecurrenceFrequency;
    const explicitFrequency = FREQUENCIES.includes(frequencyRaw) ? frequencyRaw : null;
    const isRecurring = explicitFrequency != null || TRUTHY.includes((entry.recurring || '').toLowerCase());

    if (isRecurring) {
      const frequency = explicitFrequency ?? 'daily';
      recurringRows.push({
        title,
        notes,
        priority,
        categoryId: category?.id ?? null,
        recurrenceFrequency: frequency,
        recurrenceDays: frequency === 'weekly' ? parseWeekdays(entry.days || entry.weekdays) : [],
      });
    } else {
      oneOffRows.push({
        title,
        notes,
        priority,
        categoryId: category?.id ?? null,
        dueDate: parseDate(entry.duedate || entry.date),
      });
    }
  }

  return { oneOffRows, recurringRows, total: records.length, skipped };
}
