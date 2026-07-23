import type { Account, AccountType, Category, Transaction, TransactionType } from './types';

// Finance data lives in Supabase, reached only through the app's own backend
// (server/src/finance.js) — the app never talks to Supabase directly or holds
// a Supabase key. Every call here is authenticated with the same JWT used for
// everything else (see modules/auth).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status}).`);
  }
  return data as T;
}

export function fetchAccounts(token: string, includeArchived = false): Promise<{ accounts: Account[] }> {
  return request(token, `/finance/accounts${includeArchived ? '?includeArchived=1' : ''}`);
}

export function createAccount(
  token: string,
  values: { name: string; type: AccountType; currency?: string; currentBalance?: number }
): Promise<{ account: Account }> {
  return request(token, '/finance/accounts', { method: 'POST', body: JSON.stringify(values) });
}

export function updateAccount(
  token: string,
  id: string,
  values: Partial<{ name: string; type: AccountType; currency: string; isArchived: boolean }>
): Promise<{ account: Account }> {
  return request(token, `/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
}

export function deleteAccount(token: string, id: string): Promise<void> {
  return request(token, `/finance/accounts/${id}`, { method: 'DELETE' });
}

export function fetchCategories(token: string): Promise<{ categories: Category[] }> {
  return request(token, '/finance/categories');
}

export function fetchTransactions(
  token: string,
  filters: { start?: string; end?: string; accountId?: string } = {}
): Promise<{ transactions: Transaction[] }> {
  const params = new URLSearchParams();
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  if (filters.accountId) params.set('accountId', filters.accountId);
  const query = params.toString();
  return request(token, `/finance/transactions${query ? `?${query}` : ''}`);
}

export function createTransaction(
  token: string,
  values: {
    accountId: string;
    toAccountId?: string | null;
    categoryId?: string | null;
    type: TransactionType;
    amount: number;
    date: string;
    note?: string | null;
  }
): Promise<{ transaction: Transaction }> {
  return request(token, '/finance/transactions', { method: 'POST', body: JSON.stringify(values) });
}

export function updateTransaction(
  token: string,
  id: string,
  values: Partial<{ categoryId: string | null; amount: number; date: string; note: string | null }>
): Promise<{ transaction: Transaction }> {
  return request(token, `/finance/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
}

export function deleteTransaction(token: string, id: string): Promise<void> {
  return request(token, `/finance/transactions/${id}`, { method: 'DELETE' });
}

export type FinanceSummary = {
  netWorth: number;
  income: number;
  expense: number;
  expenseByCategory: { name: string; color: string; icon: string; total: number }[];
};

export function fetchSummary(token: string, range: { start?: string; end?: string } = {}): Promise<FinanceSummary> {
  const params = new URLSearchParams();
  if (range.start) params.set('start', range.start);
  if (range.end) params.set('end', range.end);
  const query = params.toString();
  return request(token, `/finance/summary${query ? `?${query}` : ''}`);
}
