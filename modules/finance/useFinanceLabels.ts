import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

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
      await db.runAsync('INSERT INTO finance_labels (name, color) VALUES (?, ?)', [name, color]);
      await refresh();
    },
    [db, refresh]
  );

  const removeLabel = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_labels WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { labels, loading, addLabel, removeLabel };
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
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM finance_transaction_labels WHERE transaction_id = ?', [Number(targetTransactionId)]);
        for (const labelId of nextLabelIds) {
          await db.runAsync('INSERT INTO finance_transaction_labels (transaction_id, label_id) VALUES (?, ?)', [
            Number(targetTransactionId),
            Number(labelId),
          ]);
        }
      });
      await refresh();
    },
    [db, refresh]
  );

  return { labelIds, loading, setLabelsFor, refresh };
}
