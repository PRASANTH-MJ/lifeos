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

export type SpendingPriority = 'must' | 'need' | 'want';

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  priority: SpendingPriority;
};

export const PRIORITY_LABELS: Record<SpendingPriority, string> = {
  must: 'Must',
  need: 'Need',
  want: 'Want',
};

export const PRIORITY_COLORS: Record<SpendingPriority, string> = {
  must: '#FF3B30',
  need: '#FF9500',
  want: '#34C759',
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

export type Goal = {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  target_date: string | null;
  current_amount: number;
  is_closed: boolean;
  created_at: string;
};

export type GoalContribution = { id: string; goal_id: string; amount: number; date: string; created_at: string };

export type DebtDirection = 'lent' | 'borrowed';

export type Debt = {
  id: string;
  person_name: string;
  direction: DebtDirection;
  amount: number;
  note: string | null;
  is_closed: boolean;
  created_at: string;
  closed_at: string | null;
};

export type DebtPayment = { id: string; debt_id: string; amount: number; date: string; created_at: string };

export type PlannedPaymentFrequency = 'once' | 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_LABELS: Record<PlannedPaymentFrequency, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export type PlannedPayment = {
  id: string;
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense';
  amount: number;
  payee: string;
  frequency: PlannedPaymentFrequency;
  next_date: string;
  notify: boolean;
  note: string | null;
  is_active: boolean;
  created_at: string;
  is_subscription: boolean;
  remind_days_before: number;
};

export type NetWorthSnapshot = { date: string; net_worth: number };

export type SpendingAnomaly = {
  categoryId: string | null;
  categoryName: string;
  current: number;
  average: number;
  ratio: number;
};

export type Label = { id: string; name: string; color: string };

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly' | 'one_time';

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-Time',
};

export type BudgetStatus = 'on_track' | 'trending_over' | 'over_budget';

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  on_track: 'On Track',
  trending_over: 'Trending Over',
  over_budget: 'Over Budget',
};

export type BudgetPlan = {
  id: string;
  name: string;
  period: BudgetPeriod;
  amount: number;
  category_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type BudgetPlanProgress = BudgetPlan & {
  spent: number;
  daysElapsed: number;
  daysInPeriod: number;
  forecastSpend: number;
  status: BudgetStatus;
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

/** Best display currency for a figure that aggregates across accounts (net worth, budget spend,
 * goal/debt amounts, planned payments, category totals) and so has no single account of its own
 * to take a currency from — the most common currency among the user's actual accounts, rather than
 * hardcoding 'USD'. Falls back to 'USD' when there are no accounts yet.
 *
 * This is NOT currency conversion — the app has no exchange-rate logic anywhere. If a user's
 * accounts genuinely span more than one currency, a sum across them (e.g. total net worth) still
 * just adds the raw numbers unconverted; picking a display label for that sum doesn't make it
 * correct, only labeled. Real multi-currency conversion is a separate, larger feature. */
export function getDisplayCurrency(accounts: { currency: string }[]): string {
  if (accounts.length === 0) return 'USD';
  const counts = new Map<string, number>();
  for (const account of accounts) {
    counts.set(account.currency, (counts.get(account.currency) ?? 0) + 1);
  }
  let best = 'USD';
  let bestCount = 0;
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
}
