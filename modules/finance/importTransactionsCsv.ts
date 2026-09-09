import * as XLSX from 'xlsx';

import { toDateKey, todayKey } from '@/lib/date';

import type { Account, Category, TransactionType } from './types';

export type ParsedTransactionRow = {
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
};

export type ImportTransactionsResult = {
  rows: ParsedTransactionRow[];
  total: number;
  skipped: number;
};

function normalizeKeys(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
  }
  return normalized;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

/** Reads CSV text (from a file picked via expo-document-picker and read with `File#text()`) and
 * maps its rows onto existing accounts/categories by name — matched case-insensitively since
 * spreadsheet exports rarely preserve exact casing. Rows missing a resolvable account or a valid
 * positive amount are dropped rather than guessed at, and counted in `skipped` so the caller can
 * report what didn't make it in. */
export function parseTransactionsCsv(csvText: string, accounts: Account[], categories: Category[]): ImportTransactionsResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: ParsedTransactionRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const entry = normalizeKeys(record);

    const amount = Number(entry.amount || entry.amt);
    const accountName = (entry.account || entry.accountname || '').toLowerCase();
    const account = accounts.find((a) => a.name.toLowerCase() === accountName);
    const typeRaw = (entry.type || 'expense').toLowerCase();
    const type: TransactionType = typeRaw === 'income' ? 'income' : typeRaw === 'transfer' ? 'transfer' : 'expense';

    if (!account || !(amount > 0)) {
      skipped += 1;
      continue;
    }

    const categoryName = (entry.category || '').toLowerCase();
    const category = type === 'transfer' ? null : categories.find((c) => c.type === type && c.name.toLowerCase() === categoryName) ?? null;
    const note = entry.note || entry.description || null;
    const date = parseDate(entry.date) ?? todayKey();

    rows.push({ accountId: account.id, categoryId: category?.id ?? null, type, amount, date, note });
  }

  return { rows, total: records.length, skipped };
}
