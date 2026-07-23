export type TransactionType = 'expense' | 'income';

export type FinanceTransaction = {
  id: number;
  type: TransactionType;
  amount: number;
  category: string;
  note: string | null;
  date: string;
  created_at: string;
};

export const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other'];
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Other'];

export function categoriesFor(type: TransactionType): string[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

// Hardcoded to USD for now — no currency setting yet, see README.
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
}

// Whole-dollar variant for tight spaces (stat tiles) — exact cents aren't
// useful in a summary tile, and dropping them keeps the string short enough
// to avoid relying on autosize-to-fit, which react-native-web doesn't support.
export function formatCurrencyCompact(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    amount
  );
}
