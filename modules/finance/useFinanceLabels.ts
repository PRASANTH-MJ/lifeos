import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

import type { Label } from './types';

export function useFinanceLabels() {
  const db = useSQLiteContext();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ id: number; name: string; color: string }>('SELECT * FROM finance_labels ORDER BY name ASC');
      setLabels(rows.map((r) => ({ id: String(r.id), name: r.name, color: r.color })));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addLabel = useCallback(
    async (name: string, color = '#8E8E93') => {
      const result = await db.runAsync('INSERT INTO finance_labels (name, color, updated_at, sync_id) VALUES (?, ?, ?, ?)', [
        name,
        color,
        new Date().toISOString(),
        Crypto.randomUUID(),
      ]);
      await pushLocalRow(db, 'finance_labels', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const editLabel = useCallback(
    async (id: string, name: string, color: string) => {
      await db.runAsync('UPDATE finance_labels SET name = ?, color = ?, updated_at = ? WHERE id = ?', [
        name,
        color,
        new Date().toISOString(),
        Number(id),
      ]);
      await pushLocalRow(db, 'finance_labels', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const removeLabel = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving(db, 'finance_labels', Number(id));
      await db.runAsync('DELETE FROM finance_labels WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { labels, loading, addLabel, editLabel, removeLabel };
}

/** Labels attached to one transaction, plus a setter that replaces the full set in one go
 * (delete-then-insert) — simpler than diffing, and label counts per transaction are always small. */
export function useTransactionLabels(transactionId: string | null) {
  const db = useSQLiteContext();
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!transactionId) {
      setLabelIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ label_id: number }>(
        'SELECT label_id FROM finance_transaction_labels WHERE transaction_id = ?',
        [Number(transactionId)]
      );
      setLabelIds(rows.map((r) => String(r.label_id)));
    } finally {
      setLoading(false);
    }
  }, [db, transactionId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setLabelsFor = useCallback(
    async (targetTransactionId: string, nextLabelIds: string[]) => {
      // Tombstone the old links before the transaction below deletes them, and push each new
      // link after inserting it — finance_transaction_labels is a synced table (SYNC_TABLES), but
      // this was never wired up: writes here used to go straight to SQLite with no sync_id and no
      // pushLocalRow/recordDeleteBeforeRemoving call, so which labels were on a transaction never
      // left the device.
      const oldRows = await db.getAllAsync<{ rowid: number }>(
        'SELECT rowid FROM finance_transaction_labels WHERE transaction_id = ?',
        [Number(targetTransactionId)]
      );
      for (const row of oldRows) {
        await recordDeleteBeforeRemoving(db, 'finance_transaction_labels', row.rowid);
      }

      const now = new Date().toISOString();
      const insertedRowIds: number[] = [];
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM finance_transaction_labels WHERE transaction_id = ?', [Number(targetTransactionId)]);
        for (const labelId of nextLabelIds) {
          const result = await db.runAsync(
            'INSERT INTO finance_transaction_labels (transaction_id, label_id, sync_id, updated_at) VALUES (?, ?, ?, ?)',
            [Number(targetTransactionId), Number(labelId), Crypto.randomUUID(), now]
          );
          insertedRowIds.push(result.lastInsertRowId);
        }
      });
      for (const rowid of insertedRowIds) {
        await pushLocalRow(db, 'finance_transaction_labels', rowid);
      }
      await refresh();
    },
    [db, refresh]
  );

  return { labelIds, loading, setLabelsFor, refresh };
}
