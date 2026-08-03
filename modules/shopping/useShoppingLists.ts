import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import type { ShoppingList } from './types';

export type ShoppingListSummary = ShoppingList & { totalItems: number; checkedItems: number; estimate: number };

export function useShoppingLists() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<
        ShoppingList & { total_items: number; checked_items: number; estimate: number | null }
      >(
        `SELECT l.*,
                COUNT(i.id) as total_items,
                SUM(CASE WHEN i.checked THEN 1 ELSE 0 END) as checked_items,
                SUM(COALESCE(i.price, 0) * COALESCE(NULLIF(i.quantity, ''), '1')) as estimate
         FROM shopping_lists l
         LEFT JOIN shopping_items i ON i.list_id = l.id
         GROUP BY l.id
         ORDER BY l.created_at ASC`
      );
      setLists(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          totalItems: row.total_items,
          checkedItems: row.checked_items,
          estimate: row.estimate ?? 0,
        }))
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
