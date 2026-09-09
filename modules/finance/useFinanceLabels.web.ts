import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

import type { Label } from './types';

type LabelRow = { id: number; name: string; color: string };
type TransactionLabelRow = { transaction_id: number; label_id: number; sync_id?: string };

/**
 * Web build of useFinanceLabels.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine) flows into
 * every mounted instance automatically.
 */
export function useFinanceLabels() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_labels.toArray()) as LabelRow[];
    // Plain code-point comparison, not localeCompare — matches SQLite's default BINARY
    // collation (case-sensitive, byte-value order) that native's `ORDER BY name ASC` uses.
    return [...all].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }, []);

  const loading = rows === undefined;
  const labels: Label[] = (rows ?? []).map((r) => ({ id: String(r.id), name: r.name, color: r.color }));

  const addLabel = useCallback(async (name: string, color = '#8E8E93') => {
    const id = await webDb.finance_labels.add({
      name,
      color,
      updated_at: new Date().toISOString(),
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('finance_labels', id as number);
  }, []);

  const editLabel = useCallback(async (id: string, name: string, color: string) => {
    await webDb.finance_labels.update(Number(id), { name, color, updated_at: new Date().toISOString() });
    await pushLocalRow('finance_labels', Number(id));
  }, []);

  const removeLabel = useCallback(async (id: string) => {
    await recordDeleteBeforeRemoving('finance_labels', Number(id));
    await webDb.finance_labels.delete(Number(id));
  }, []);

  return { labels, loading, addLabel, editLabel, removeLabel };
}

/** Labels attached to one transaction, plus a setter that replaces the full set in one go
 * (delete-then-insert) — simpler than diffing, and label counts per transaction are always small. */
export function useTransactionLabels(transactionId: string | null) {
  const rows = useLiveQuery(async () => {
    if (!transactionId) return [];
    const all = (await webDb.finance_transaction_labels.toArray()) as TransactionLabelRow[];
    return all.filter((r) => r.transaction_id === Number(transactionId));
  }, [transactionId]);

  const loading = rows === undefined;
  const labelIds: string[] = (rows ?? []).map((r) => String(r.label_id));

  const setLabelsFor = useCallback(async (targetTransactionId: string, nextLabelIds: string[]) => {
    const txId = Number(targetTransactionId);
    const now = new Date().toISOString();
    // Tombstone the old links and push the new ones — finance_transaction_labels is a synced
    // table (SYNC_TABLES), but this was never wired up: writes here used to go straight to Dexie
    // with no sync_id and no pushLocalRow/recordDeleteBeforeRemoving call, so which labels were on
    // a transaction never left the device.
    const existing = (await webDb.finance_transaction_labels.where('transaction_id').equals(txId).toArray()) as TransactionLabelRow[];
    for (const row of existing) {
      await recordDeleteBeforeRemoving('finance_transaction_labels', [row.transaction_id, row.label_id]);
    }

    const nextRows = nextLabelIds.map((labelId) => ({
      transaction_id: txId,
      label_id: Number(labelId),
      sync_id: Crypto.randomUUID(),
      updated_at: now,
    }));
    await webDb.transaction('rw', [webDb.finance_transaction_labels], async () => {
      await webDb.finance_transaction_labels.bulkDelete(existing.map((r) => [r.transaction_id, r.label_id] as never));
      await webDb.finance_transaction_labels.bulkAdd(nextRows as never[]);
    });
    for (const row of nextRows) {
      await pushLocalRow('finance_transaction_labels', [row.transaction_id, row.label_id]);
    }
  }, []);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { labelIds, loading, setLabelsFor, refresh };
}
