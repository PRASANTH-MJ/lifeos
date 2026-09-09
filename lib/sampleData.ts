import { addDays, todayKey } from '@/lib/date';
import type { Account, Category, TransactionType } from '@/modules/finance';

export type SampleTransactionInput = {
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  note?: string | null;
};

const SAMPLE_TRANSACTIONS: { daysAgo: number; type: TransactionType; categoryName: string; amount: number; note: string }[] = [
  { daysAgo: 0, type: 'expense', categoryName: 'Groceries', amount: 1450, note: 'Weekly groceries' },
  { daysAgo: 1, type: 'expense', categoryName: 'Transport', amount: 220, note: 'Cab to work' },
  { daysAgo: 2, type: 'expense', categoryName: 'Entertainment', amount: 599, note: 'Movie night' },
  { daysAgo: 3, type: 'income', categoryName: 'Salary', amount: 65000, note: 'Monthly salary' },
  { daysAgo: 4, type: 'expense', categoryName: 'Housing', amount: 18000, note: 'Rent' },
  { daysAgo: 5, type: 'expense', categoryName: 'Health', amount: 850, note: 'Pharmacy' },
  { daysAgo: 7, type: 'expense', categoryName: 'Shopping', amount: 2100, note: 'New shoes' },
  { daysAgo: 9, type: 'income', categoryName: 'Freelance', amount: 8000, note: 'Design project' },
  { daysAgo: 10, type: 'expense', categoryName: 'Groceries', amount: 980, note: 'Top-up groceries' },
  { daysAgo: 12, type: 'expense', categoryName: 'Entertainment', amount: 349, note: 'Streaming subscription' },
];

/** Inserts a small set of realistic example transactions against the user's first account,
 * matched to their real category names (falls back to no category if a name isn't found —
 * users can rename/delete the seeded finance categories). Returns how many were inserted. */
export async function loadSampleTransactions(
  accounts: Account[],
  categories: Category[],
  addTransaction: (values: SampleTransactionInput, options?: { skipDuplicateCheck?: boolean }) => Promise<string | null>
): Promise<number> {
  if (accounts.length === 0) return 0;
  const account = accounts[0];
  const today = todayKey();

  for (const sample of SAMPLE_TRANSACTIONS) {
    const category = categories.find((c) => c.type === sample.type && c.name === sample.categoryName) ?? null;
    await addTransaction(
      {
        accountId: account.id,
        categoryId: category?.id ?? null,
        type: sample.type,
        amount: sample.amount,
        date: addDays(today, -sample.daysAgo),
        note: sample.note,
      },
      { skipDuplicateCheck: true }
    );
  }

  return SAMPLE_TRANSACTIONS.length;
}

export const SAMPLE_SHOPPING_LIST_NAME = 'Groceries (sample)';

export const SAMPLE_SHOPPING_ITEMS: { name: string; quantity: string; price: number | null }[] = [
  { name: 'Milk', quantity: '2 L', price: 60 },
  { name: 'Eggs', quantity: '12', price: 90 },
  { name: 'Bread', quantity: '1', price: 45 },
  { name: 'Rice', quantity: '5 kg', price: 350 },
  { name: 'Bananas', quantity: '1 dozen', price: 55 },
  { name: 'Olive oil', quantity: '1', price: 420 },
  { name: 'Coffee', quantity: '1', price: 280 },
];

/** Fills an (expected-empty) list with the fixed sample items above, through the exact
 * `addItem(name, quantity, price)` signature `useShoppingList` already exposes — this is called
 * from the new list's own detail screen right after creation, so it works the same way on native
 * and web without reaching around either platform's DB layer directly. */
export async function loadSampleShoppingItems(
  addItem: (name: string, quantity?: string | null, price?: number | null) => Promise<void>
): Promise<number> {
  for (const item of SAMPLE_SHOPPING_ITEMS) {
    await addItem(item.name, item.quantity, item.price);
  }
  return SAMPLE_SHOPPING_ITEMS.length;
}
