import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { showAlert } from '@/components';
import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

import type { Transaction, TransactionType } from './types';

type TransactionRow = {
  id: number;
  account_id: number;
  category_id: number | null;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  to_account_id: number | null;
  created_at: string;
  updated_at?: string;
  sync_id?: string;
};

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    category_id: row.category_id != null ? String(row.category_id) : null,
    type: row.type,
    amount: row.amount,
    date: row.date,
    note: row.note,
    to_account_id: row.to_account_id != null ? String(row.to_account_id) : null,
    created_at: row.created_at,
  };
}

/** Mirrors finance_transactions' multi-column CHECK constraint (db/schema.ts) — SQLite would
 * reject an insert/update violating this; IndexedDB has no such guard, so it must be explicit. */
function assertValidTransactionShape(values: {
  type: TransactionType;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
}): void {
  if (values.type === 'transfer') {
    if (values.toAccountId == null) throw new Error('A transfer transaction requires a destination account.');
    if (values.toAccountId === values.accountId) throw new Error('A transfer cannot target its own source account.');
    if (values.categoryId != null) throw new Error('A transfer transaction cannot have a category.');
  } else if (values.toAccountId != null) {
    throw new Error('Only transfer transactions may have a destination account.');
  }
}

/** Mirrors finance_transactions' `CHECK (amount > 0)` (db/schema.ts) — SQLite would reject an
 * insert/update violating this; IndexedDB has no such guard, so it must be explicit. Left
 * unguarded, a zero/negative amount silently corrupts finance_accounts.current_balance instead
 * of failing loudly. */
function assertPositiveAmount(amount: number): void {
  if (!(amount > 0)) throw new Error('Transaction amount must be greater than 0.');
}

/** Replaces trg_finance_tx_update's unconditional `updated_at = datetime('now')` on the
 * affected account(s) — the SQL trigger touches this on every UPDATE of finance_transactions
 * regardless of whether the balance-affecting amount actually changed, which matters because
 * modules/sync/syncEngine.web.ts's merge is last-write-wins on exactly this field. */
async function touchAccountsUpdatedAt(accountId: number, toAccountId: number | null): Promise<void> {
  const now = new Date().toISOString();
  await webDb.finance_accounts.update(accountId, { updated_at: now });
  if (toAccountId != null) await webDb.finance_accounts.update(toAccountId, { updated_at: now });
}

/** Replaces trg_finance_tx_insert (db/schema.ts): applies the same signed-amount arithmetic to
 * finance_accounts.current_balance that the SQL trigger fired on INSERT, inside the same
 * transaction as the row insert. */
async function applyInsertBalanceEffect(tx: {
  type: TransactionType;
  amount: number;
  account_id: number;
  to_account_id: number | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const account = await webDb.finance_accounts.get(tx.account_id);
  if (account) {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    await webDb.finance_accounts.update(tx.account_id, {
      current_balance: ((account as { current_balance?: number }).current_balance ?? 0) + delta,
      updated_at: now,
    });
  }
  if (tx.type === 'transfer' && tx.to_account_id != null) {
    const toAccount = await webDb.finance_accounts.get(tx.to_account_id);
    if (toAccount) {
      await webDb.finance_accounts.update(tx.to_account_id, {
        current_balance: ((toAccount as { current_balance?: number }).current_balance ?? 0) + tx.amount,
        updated_at: now,
      });
    }
  }
}

/** Replaces trg_finance_tx_delete (db/schema.ts): reverses the same signed-amount arithmetic
 * the SQL trigger applied on DELETE, inside the same transaction as the row removal. */
async function applyDeleteBalanceEffect(tx: {
  type: TransactionType;
  amount: number;
  account_id: number;
  to_account_id: number | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const account = await webDb.finance_accounts.get(tx.account_id);
  if (account) {
    const delta = tx.type === 'income' ? tx.amount : -tx.amount;
    await webDb.finance_accounts.update(tx.account_id, {
      current_balance: ((account as { current_balance?: number }).current_balance ?? 0) - delta,
      updated_at: now,
    });
  }
  if (tx.type === 'transfer' && tx.to_account_id != null) {
    const toAccount = await webDb.finance_accounts.get(tx.to_account_id);
    if (toAccount) {
      await webDb.finance_accounts.update(tx.to_account_id, {
        current_balance: ((toAccount as { current_balance?: number }).current_balance ?? 0) - tx.amount,
        updated_at: now,
      });
    }
  }
}

/** Web mirror of useTransactions.ts's duplicate guard — see that file's doc comment. */
const DUPLICATE_WINDOW_MS = 10_000;

async function findRecentSimilarTransaction(accountId: number, categoryId: number | null, amount: number, date: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const rows = (await webDb.finance_transactions.where('account_id').equals(accountId).toArray()) as TransactionRow[];
  return rows.some(
    (row) =>
      row.amount === amount &&
      row.date === date &&
      (row.category_id ?? null) === categoryId &&
      (row.created_at ?? '') >= cutoff
  );
}

function confirmSaveDuplicate(): Promise<boolean> {
  return new Promise((resolve) => {
    showAlert(
      'Possible duplicate',
      'This looks like a duplicate of an entry from a moment ago — save anyway?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Save anyway', onPress: () => resolve(true) },
      ]
    );
  });
}

/**
 * Web build of useTransactions.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or from the sync engine's
 * merge) makes every mounted useTransactions() instance re-render automatically.
 *
 * The SQL triggers trg_finance_tx_insert/update/delete (db/schema.ts) that kept
 * finance_accounts.current_balance in sync have no IndexedDB equivalent, so their exact
 * signed-amount arithmetic is replicated explicitly in applyInsertBalanceEffect /
 * applyDeleteBalanceEffect below, run inside the same Dexie transaction as the write that
 * would have fired them.
 */
export function useTransactions(start?: string, end?: string, accountId?: string) {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_transactions.toArray()) as TransactionRow[];
    const acctNum = accountId ? Number(accountId) : undefined;
    const filtered = all.filter((row) => {
      if (start && row.date < start) return false;
      if (end && row.date > end) return false;
      if (acctNum !== undefined && row.account_id !== acctNum && row.to_account_id !== acctNum) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [start, end, accountId]);

  const loading = rows === undefined;
  const transactions = (rows ?? []).map(toTransaction);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addTransaction = useCallback(
    async (
      values: {
        accountId: string;
        toAccountId?: string | null;
        categoryId?: string | null;
        type: TransactionType;
        amount: number;
        date: string;
        note?: string | null;
      },
      options?: { skipDuplicateCheck?: boolean }
    ) => {
      const now = new Date().toISOString();
      const accountIdNum = Number(values.accountId);
      const toAccountId = values.type === 'transfer' && values.toAccountId ? Number(values.toAccountId) : null;
      const categoryId = values.type === 'transfer' ? null : values.categoryId ? Number(values.categoryId) : null;

      assertValidTransactionShape({ type: values.type, accountId: accountIdNum, toAccountId, categoryId });
      assertPositiveAmount(values.amount);

      if (!options?.skipDuplicateCheck) {
        const isDuplicate = await findRecentSimilarTransaction(accountIdNum, categoryId, values.amount, values.date);
        if (isDuplicate && !(await confirmSaveDuplicate())) return null;
      }

      const newId = await webDb.transaction('rw', [webDb.finance_transactions, webDb.finance_accounts], async () => {
        const id = (await webDb.finance_transactions.add({
          account_id: accountIdNum,
          category_id: categoryId,
          type: values.type,
          amount: values.amount,
          date: values.date,
          note: values.note ?? null,
          to_account_id: toAccountId,
          created_at: now,
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;

        // Replaces trg_finance_tx_insert.
        await applyInsertBalanceEffect({
          type: values.type,
          amount: values.amount,
          account_id: accountIdNum,
          to_account_id: toAccountId,
        });

        return id;
      });

      await pushLocalRow('finance_transactions', newId);
      // The insert trigger recomputes current_balance directly via SQL, not through this file's
      // own writes — push the affected account(s) so the recalculated balance syncs too.
      await pushLocalRow('finance_accounts', accountIdNum);
      if (toAccountId) await pushLocalRow('finance_accounts', toAccountId);
      await refresh();
      return String(newId);
    },
    [refresh]
  );

  const editTransaction = useCallback(
    async (id: string, values: Partial<{ categoryId: string | null; amount: number; date: string; note: string | null }>) => {
      const idNum = Number(id);
      const updates: Record<string, unknown> = {};
      if (values.categoryId !== undefined) updates.category_id = values.categoryId ? Number(values.categoryId) : null;
      if (values.amount !== undefined) {
        assertPositiveAmount(values.amount);
        updates.amount = values.amount;
      }
      if (values.date !== undefined) updates.date = values.date;
      if (values.note !== undefined) updates.note = values.note;
      if (Object.keys(updates).length === 0) return;
      updates.updated_at = new Date().toISOString();

      let affectedAccountId: number | undefined;
      let affectedToAccountId: number | null | undefined;

      await webDb.transaction('rw', [webDb.finance_transactions, webDb.finance_accounts], async () => {
        const before = (await webDb.finance_transactions.get(idNum)) as TransactionRow | undefined;
        if (!before) return;

        if (values.categoryId !== undefined && before.type === 'transfer' && updates.category_id != null) {
          throw new Error('A transfer transaction cannot have a category.');
        }

        await webDb.finance_transactions.update(idNum, updates);

        if (values.amount !== undefined) {
          // Replaces trg_finance_tx_update: reverse the old amount's effect, then apply the new
          // amount's effect (type/account/to_account never change via editTransaction, matching
          // the native hook, which only lets amount/date/note/category be edited).
          await applyDeleteBalanceEffect({
            type: before.type,
            amount: before.amount,
            account_id: before.account_id,
            to_account_id: before.to_account_id,
          });
          await applyInsertBalanceEffect({
            type: before.type,
            amount: values.amount,
            account_id: before.account_id,
            to_account_id: before.to_account_id,
          });
        } else {
          // trg_finance_tx_update bumps the affected account(s)' updated_at unconditionally on
          // every UPDATE, even one that doesn't change amount (e.g. editing only note/date) —
          // applyDeleteBalanceEffect/applyInsertBalanceEffect above already cover that when
          // amount *is* changing, so this only needs to run in the no-amount-change case.
          await touchAccountsUpdatedAt(before.account_id, before.to_account_id);
        }

        affectedAccountId = before.account_id;
        affectedToAccountId = before.to_account_id;
      });

      await pushLocalRow('finance_transactions', idNum);
      // The update trigger recomputes current_balance for the transaction's account(s) — push
      // those too so the recalculated balance syncs.
      if (affectedAccountId != null) {
        await pushLocalRow('finance_accounts', affectedAccountId);
        if (affectedToAccountId) await pushLocalRow('finance_accounts', affectedToAccountId);
      }
      await refresh();
    },
    [refresh]
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const idNum = Number(id);
      let affectedAccountId: number | undefined;
      let affectedToAccountId: number | null | undefined;

      // finance_transaction_labels has no cascade on web (Dexie has none at all) — clean up the
      // label links here too, or they're orphaned in IndexedDB with no tombstone for other
      // devices to reconcile against.
      const labelRows = (await webDb.finance_transaction_labels.where('transaction_id').equals(idNum).toArray()) as {
        transaction_id: number;
        label_id: number;
      }[];
      for (const labelRow of labelRows) {
        await recordDeleteBeforeRemoving('finance_transaction_labels', [labelRow.transaction_id, labelRow.label_id]);
        await webDb.finance_transaction_labels.delete([labelRow.transaction_id, labelRow.label_id] as never);
      }

      await recordDeleteBeforeRemoving('finance_transactions', idNum);

      await webDb.transaction('rw', [webDb.finance_transactions, webDb.finance_accounts], async () => {
        const row = (await webDb.finance_transactions.get(idNum)) as TransactionRow | undefined;
        if (!row) return;
        await webDb.finance_transactions.delete(idNum);
        // Replaces trg_finance_tx_delete.
        await applyDeleteBalanceEffect({
          type: row.type,
          amount: row.amount,
          account_id: row.account_id,
          to_account_id: row.to_account_id,
        });
        affectedAccountId = row.account_id;
        affectedToAccountId = row.to_account_id;
      });

      // The delete trigger recomputes current_balance for the transaction's account(s) — push
      // those too so the recalculated balance syncs.
      if (affectedAccountId != null) {
        await pushLocalRow('finance_accounts', affectedAccountId);
        if (affectedToAccountId) await pushLocalRow('finance_accounts', affectedToAccountId);
      }
      await refresh();
    },
    [refresh]
  );

  return { transactions, loading, refresh, addTransaction, editTransaction, removeTransaction };
}
