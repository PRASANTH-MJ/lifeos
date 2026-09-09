import * as Crypto from 'expo-crypto';
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

import { getDisplayCurrency } from './types';
import type { Account, AccountType } from './types';

type AccountRow = {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  current_balance: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  sync_id?: string;
};

const ACCOUNT_TYPES: AccountType[] = ['general', 'cash', 'investment', 'credit'];

// Replicates db/schema.ts's `type TEXT NOT NULL CHECK (type IN ('general', 'cash',
// 'investment', 'credit'))` constraint on finance_accounts, which IndexedDB has no equivalent
// for.
function assertValidAccountType(type: AccountType): void {
  if (!ACCOUNT_TYPES.includes(type)) {
    throw new Error(`Invalid account type: ${type}`);
  }
}

function toAccount(row: AccountRow): Account {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    currency: row.currency,
    current_balance: row.current_balance,
    is_archived: !!row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Web build of useAccounts.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: every tab showing accounts re-renders automatically the
 * instant any tab (or the sync engine, or useTransactions.web.ts's balance-adjusting writes)
 * touches finance_accounts, which is what the native version's focus-triggered refresh() was
 * standing in for.
 */
export function useAccounts() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_accounts.toArray()) as AccountRow[];
    return all
      .filter((row) => !row.is_archived)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }, []);

  const loading = rows === undefined;
  const accounts = useMemo(() => (rows ?? []).map(toAccount), [rows]);

  const refresh = async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  };

  const addAccount = async (values: { name: string; type: AccountType; currency?: string; currentBalance?: number }) => {
    assertValidAccountType(values.type);
    const now = new Date().toISOString();
    const id = await webDb.finance_accounts.add({
      name: values.name,
      type: values.type,
      currency: values.currency ?? 'USD',
      current_balance: values.currentBalance ?? 0,
      is_archived: 0,
      created_at: now,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('finance_accounts', id as number);
  };

  const editAccount = async (
    id: string,
    values: Partial<{ name: string; type: AccountType; currency: string; isArchived: boolean }>
  ) => {
    const updates: Record<string, unknown> = {};
    if (values.name !== undefined) updates.name = values.name;
    if (values.type !== undefined) {
      assertValidAccountType(values.type);
      updates.type = values.type;
    }
    if (values.currency !== undefined) updates.currency = values.currency;
    if (values.isArchived !== undefined) updates.is_archived = values.isArchived ? 1 : 0;
    if (Object.keys(updates).length === 0) return;
    updates.updated_at = new Date().toISOString();
    await webDb.finance_accounts.update(Number(id), updates);
    await pushLocalRow('finance_accounts', Number(id));
  };

  const archiveAccount = (id: string) => editAccount(id, { isArchived: true });

  const removeAccount = async (id: string) => {
    // finance_transactions.to_account_id is declared ON DELETE RESTRICT (db/schema.ts) — on
    // native, SQLite itself refuses the delete (and preserves the account) if any transfer still
    // targets it. IndexedDB has no FK enforcement, so this must be checked explicitly and throw
    // instead of silently deleting the account and leaving those transactions' to_account_id
    // pointing at nothing.
    const incomingTransfers = await webDb.finance_transactions.where('to_account_id').equals(Number(id)).count();
    if (incomingTransfers > 0) {
      throw new Error('This account can’t be deleted because it’s the destination of one or more transfers. Delete or reassign those transfers first.');
    }

    // finance_transactions.account_id is declared ON DELETE CASCADE (db/schema.ts) — SQLite
    // enforces that itself via a real foreign key, but Dexie/IndexedDB has no such thing, so this
    // function must delete the dependent transactions itself. Tombstone each of those
    // transactions first (same recordDeleteBeforeRemoving + delete pattern
    // useTransactions().removeTransaction uses for a single row) so the cascade is still
    // recorded for sync instead of rows vanishing on this device with no tombstone for other
    // devices to reconcile against.
    await webDb.transaction(
      'rw',
      [webDb.finance_transactions, webDb.finance_accounts, webDb.finance_transaction_labels, webDb.sync_tombstones, webDb.sync_outbox],
      async () => {
        const transactionRows = await webDb.finance_transactions.where('account_id').equals(Number(id)).toArray();
        for (const row of transactionRows) {
          const transactionId = (row as { id: number }).id;
          // finance_transactions.account_id cascades on native; on web nothing cascades at all, so
          // the label links one level deeper must be cleaned up here too, or they're simply
          // orphaned in IndexedDB forever with no tombstone for other devices either.
          const labelRows = (await webDb.finance_transaction_labels.where('transaction_id').equals(transactionId).toArray()) as {
            transaction_id: number;
            label_id: number;
          }[];
          for (const labelRow of labelRows) {
            await recordDeleteBeforeRemoving('finance_transaction_labels', [labelRow.transaction_id, labelRow.label_id]);
            await webDb.finance_transaction_labels.delete([labelRow.transaction_id, labelRow.label_id] as never);
          }
          await recordDeleteBeforeRemoving('finance_transactions', transactionId);
          await webDb.finance_transactions.delete(transactionId);
        }
        await recordDeleteBeforeRemoving('finance_accounts', Number(id));
        await webDb.finance_accounts.delete(Number(id));
      }
    );
  };

  const netWorth = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.current_balance), 0), [accounts]);
  // Most common currency among the user's accounts — a display default for aggregate figures
  // (net worth, budget totals, etc.) that don't come from one account and so have no currency of
  // their own. See getDisplayCurrency's doc comment: this is a label choice, not conversion.
  const displayCurrency = useMemo(() => getDisplayCurrency(accounts), [accounts]);
  const accountsByType = useMemo(() => {
    const groups = new Map<string, Account[]>();
    for (const account of accounts) {
      const list = groups.get(account.type) ?? [];
      list.push(account);
      groups.set(account.type, list);
    }
    return groups;
  }, [accounts]);

  return { accounts, accountsByType, netWorth, displayCurrency, loading, refresh, addAccount, editAccount, archiveAccount, removeAccount };
}
