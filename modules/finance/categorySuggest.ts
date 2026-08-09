import type { TransactionType } from './types';

/** Keyword → default category name, matched case-insensitively as a substring of whatever the
 * user types in the transaction note. Rule-based (no AI call needed) — only ever suggests, never
 * overrides a category the user already picked themselves. Matches the default seeded category
 * names (see SEED_FINANCE_CATEGORIES in db/schema.ts); if the user renamed/deleted a category this
 * simply won't find a match, which is a safe no-op. */
const EXPENSE_KEYWORDS: Record<string, string[]> = {
  Groceries: ['grocery', 'groceries', 'supermarket', 'bigbasket', 'zepto', 'blinkit', 'dmart', 'kirana', 'vegetable', 'fruits'],
  Transport: ['uber', 'ola', 'taxi', 'auto', 'petrol', 'fuel', 'diesel', 'metro', 'parking', 'cab', 'rapido'],
  Housing: ['rent', 'maintenance', 'electricity', 'water bill', 'gas bill', 'wifi', 'broadband', 'society'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'shopping', 'mall'],
  Health: ['pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'apollo', 'medplus', 'medical'],
  Entertainment: ['movie', 'netflix', 'spotify', 'cinema', 'pvr', 'inox', 'concert', 'prime video', 'hotstar'],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
  Salary: ['salary', 'payroll'],
  Freelance: ['freelance', 'client payment', 'invoice'],
  Investment: ['dividend', 'interest', 'mutual fund', 'stocks', 'sip'],
};

export function suggestCategoryName(note: string, type: TransactionType): string | null {
  const text = note.trim().toLowerCase();
  if (!text) return null;
  const table = type === 'income' ? INCOME_KEYWORDS : type === 'expense' ? EXPENSE_KEYWORDS : null;
  if (!table) return null;
  for (const [category, keywords] of Object.entries(table)) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return null;
}
