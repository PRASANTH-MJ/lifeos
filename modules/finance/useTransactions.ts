import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { showAlert } from '@/components';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

import type { Transaction, TransactionType } from './types';

/** Guards against the two realistic double-log causes (a double "Save" tap, or a flaky-network
 * retry) — same account+category+amount logged again on the same day within this window is
 * treated as "probably the same transaction" and prompts a confirm rather than silently writing
 * a second row. Bulk paths (CSV import, sample data) pass skipDuplicateCheck: legitimately
 * repeated same-day/same-amount rows there (e.g. two coffees) shouldn't each stop for a popup. */
const DUPLICATE_WINDOW_MS = 10_000;

async function findRecentSimilarTransaction(
  db: SQLiteDatabase,
  accountId: number,
  categoryId: number | null,
  amount: number,
  date: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM finance_transactions
     WHERE account_id = ? AND amount = ? AND date = ? AND created_at >= ? AND category_id IS ?`,
    [accountId, amount, date, cutoff, categoryId]
  );
  return row != null;
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

export function useTransactions(start?: string, end?: string, accountId?: string) {
  const db = useSQLiteContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (start) {
        clauses.push('date >= ?');
        params.push(start);
      }
      if (end) {
        clauses.push('date <= ?');
        params.push(end);
      }
      if (accountId) {
        clauses.push('(account_id = ? OR to_account_id = ?)');
        params.push(Number(accountId), Number(accountId));
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await db.getAllAsync<TransactionRow>(
        `SELECT * FROM finance_transactions ${where} ORDER BY date DESC, created_at DESC`,
        params
      );
      setTransactions(rows.map(toTransaction));
    } finally {
      setLoading(false);
    }
  }, [db, start, end, accountId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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
      const accountIdNum = Number(values.accountId);
      const categoryId = values.type === 'transfer' ? null : values.categoryId ? Number(values.categoryId) : null;

      if (!options?.skipDuplicateCheck) {
        const isDuplicate = await findRecentSimilarTransaction(db, accountIdNum, categoryId, values.amount, values.date);
        if (isDuplicate && !(await confirmSaveDuplicate())) return null;
      }

      const now = new Date().toISOString();
      const toAccountId = values.type === 'transfer' && values.toAccountId ? Number(values.toAccountId) : null;
      const result = await db.runAsync(
        `INSERT INTO finance_transactions (account_id, category_id, type, amount, date, note, to_account_id, created_at, updated_at, sync_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountIdNum, categoryId, values.type, values.amount, values.date, values.note ?? null, toAccountId, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'finance_transactions', result.lastInsertRowId);
      // The insert trigger recomputes current_balance directly via SQL, not through this file's
      // own runAsync calls — push the affected account(s) so the recalculated balance syncs too.
      await pushLocalRow(db, 'finance_accounts', accountIdNum);
      if (toAccountId) await pushLocalRow(db, 'finance_accounts', toAccountId);
      await refresh();
      return String(result.lastInsertRowId);
    },
    [db, refresh]
  );

  const editTransaction = useCallback(
    async (id: string, values: Partial<{ categoryId: string | null; amount: number; date: string; note: string | null }>) => {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      if (values.categoryId !== undefined) {
        updates.push('category_id = ?');
        params.push(values.categoryId ? Number(values.categoryId) : null);
      }
      if (values.amount !== undefined) {
        updates.push('amount = ?');
        params.push(values.amount);
      }
      if (values.date !== undefined) {
        updates.push('date = ?');
        params.push(values.date);
      }
      if (values.note !== undefined) {
        updates.push('note = ?');
        params.push(values.note);
      }
      if (updates.length === 0) return;
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(Number(id));
      await db.runAsync(`UPDATE finance_transactions SET ${updates.join(', ')} WHERE id = ?`, params);
      await pushLocalRow(db, 'finance_transactions', Number(id));
      // The update trigger recomputes current_balance for the transaction's account(s) — push
      // those too so the recalculated balance syncs.
      const row = await db.getFirstAsync<{ account_id: number; to_account_id: number | null }>(
        'SELECT account_id, to_account_id FROM finance_transactions WHERE id = ?',
        [Number(id)]
      );
      if (row) {
        await pushLocalRow(db, 'finance_accounts', row.account_id);
        if (row.to_account_id) await pushLocalRow(db, 'finance_accounts', row.to_account_id);
      }
      await refresh();
    },
    [db, refresh]
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const row = await db.getFirstAsync<{ account_id: number; to_account_id: number | null }>(
        'SELECT account_id, to_account_id FROM finance_transactions WHERE id = ?',
        [Number(id)]
      );
      // finance_transaction_labels.transaction_id is ON DELETE CASCADE — tombstone those links
      // before deleting the transaction, or other devices never learn they were removed.
      const labelRows = await db.getAllAsync<{ rowid: number }>('SELECT rowid FROM finance_transaction_labels WHERE transaction_id = ?', [
        Number(id),
      ]);
      for (const labelRow of labelRows) {
        await recordDeleteBeforeRemoving(db, 'finance_transaction_labels', labelRow.rowid);
      }
      await recordDeleteBeforeRemoving(db, 'finance_transactions', Number(id));
      await db.runAsync('DELETE FROM finance_transactions WHERE id = ?', [Number(id)]);
      // The delete trigger recomputes current_balance for the transaction's account(s) — push
      // those too so the recalculated balance syncs.
      if (row) {
        await pushLocalRow(db, 'finance_accounts', row.account_id);
        if (row.to_account_id) await pushLocalRow(db, 'finance_accounts', row.to_account_id);
      }
      await refresh();
    },
    [db, refresh]
  );

  return { transactions, loading, refresh, addTransaction, editTransaction, removeTransaction };
}
