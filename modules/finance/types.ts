export type AccountType = 'general' | 'cash' | 'investment' | 'credit';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  current_balance: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryType = 'income' | 'expense';

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  to_account_id: string | null;
  created_at: string;
};

export type FinanceSummary = {
  netWorth: number;
  income: number;
  expense: number;
  expenseByCategory: { name: string; color: string; icon: string; total: number }[];
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  general: 'General',
  cash: 'Cash',
  investment: 'Investment',
  credit: 'Credit',
};

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

// Whole-unit variant for tight spaces (stat tiles) — exact cents aren't
// useful in a summary tile, and dropping them keeps the string short enough
// to avoid relying on autosize-to-fit, which react-native-web doesn't support.
export function formatCurrencyCompact(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}
