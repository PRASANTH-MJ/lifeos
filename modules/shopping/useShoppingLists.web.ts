import * as Crypto from 'expo-crypto';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import { itemLineTotal } from './quantity';
import type { ShoppingList, ShoppingUnit } from './types';

export type ShoppingListSummary = ShoppingList & { totalItems: number; checkedItems: number; estimate: number };

type ShoppingListRow = ShoppingList & { sync_id?: string; updated_at?: string };
type ShoppingItemRow = { id: number; list_id: number; price: number | null; quantity: string | null; unit: ShoppingUnit | null; checked: number };

/**
 * Web build of useShoppingLists.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine) re-runs
 * the join/aggregation below and updates every mounted instance automatically.
 */
export function useShoppingLists() {
  const lists = useLiveQuery(async () => {
    const [listRows, itemRows] = await Promise.all([
      webDb.shopping_lists.toArray() as unknown as Promise<ShoppingListRow[]>,
      webDb.shopping_items.toArray() as unknown as Promise<ShoppingItemRow[]>,
    ]);

    const itemsByList = new Map<number, ShoppingItemRow[]>();
    for (const item of itemRows) {
      const bucket = itemsByList.get(item.list_id);
      if (bucket) bucket.push(item);
      else itemsByList.set(item.list_id, [item]);
    }

    const summaries: ShoppingListSummary[] = listRows.map((row) => {
      const items = itemsByList.get(row.id) ?? [];
      const totalItems = items.length;
      const checkedItems = items.reduce((sum, item) => sum + (item.checked ? 1 : 0), 0);
      const estimate = items.reduce((sum, item) => sum + itemLineTotal(item.price, item.quantity, item.unit), 0);
      return { id: row.id, name: row.name, created_at: row.created_at, totalItems, checkedItems, estimate };
    });

    return summaries.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  }, []);

  const loading = lists === undefined;

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addList = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const id = await webDb.shopping_lists.add({
      name,
      created_at: now,
      updated_at: now,
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('shopping_lists', id as number);
    return id as number;
  }, []);

  const removeList = useCallback(async (id: number) => {
    // shopping_items.list_id has an SQL "ON DELETE CASCADE" FK to shopping_lists(id)
    // (see db/schema.ts); IndexedDB has no FK cascade, so the child rows are deleted
    // explicitly here, in the same transaction as the list delete, to match that behavior.
    await webDb.transaction('rw', [webDb.shopping_lists, webDb.shopping_items], async () => {
      const orphanedItems = (await webDb.shopping_items.where('list_id').equals(id).toArray()) as { id: number }[];
      for (const item of orphanedItems) {
        await recordDeleteBeforeRemoving('shopping_items', item.id);
      }
      await recordDeleteBeforeRemoving('shopping_lists', id);
      await webDb.shopping_lists.delete(id);
      await webDb.shopping_items.bulkDelete(orphanedItems.map((item) => item.id));
    });
  }, []);

  return { lists: lists ?? [], loading, refresh, addList, removeList };
}
