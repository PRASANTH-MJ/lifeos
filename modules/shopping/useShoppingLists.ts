import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import { itemLineTotal } from './quantity';
import type { ShoppingItem, ShoppingList } from './types';

export type ShoppingListSummary = ShoppingList & { totalItems: number; checkedItems: number; estimate: number };

export function useShoppingLists() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // The estimate is computed here in JS via the shared itemLineTotal — not a raw SQL SUM — so
  // this overview screen can never again drift out of sync with the detail screen's own total
  // the way it did when each had its own quantity-parsing arithmetic (see quantity.ts).
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listRows, itemRows] = await Promise.all([
        db.getAllAsync<ShoppingList>('SELECT * FROM shopping_lists ORDER BY created_at ASC'),
        db.getAllAsync<ShoppingItem>('SELECT * FROM shopping_items'),
      ]);
      const itemsByList = new Map<number, ShoppingItem[]>();
      for (const item of itemRows) {
        const bucket = itemsByList.get(item.list_id);
        if (bucket) bucket.push(item);
        else itemsByList.set(item.list_id, [item]);
      }
      setLists(
        listRows.map((row) => {
          const items = itemsByList.get(row.id) ?? [];
          return {
            id: row.id,
            name: row.name,
            created_at: row.created_at,
            totalItems: items.length,
            checkedItems: items.reduce((sum, item) => sum + (item.checked ? 1 : 0), 0),
            estimate: items.reduce((sum, item) => sum + itemLineTotal(item.price, item.quantity, item.unit), 0),
          };
        })
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addList = useCallback(
    async (name: string) => {
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO shopping_lists (name, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?)',
        [name, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'shopping_lists', result.lastInsertRowId);
      await refresh();
      return result.lastInsertRowId;
    },
    [db, refresh]
  );

  const removeList = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, 'shopping_lists', id);
      await db.runAsync('DELETE FROM shopping_lists WHERE id = ?', [id]);
      await refresh();
    },
    [db, refresh]
  );

  return { lists, loading, refresh, addList, removeList };
}
