import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { ShoppingItem } from './types';

export function useShoppingList() {
  const table = useLocalTable<ShoppingItem>('shopping_items', {
    orderBy: 'checked ASC, sort_order ASC, created_at ASC',
  });

  const addItem = useCallback(
    async (name: string, quantity?: string | null) => {
      await table.insert({
        name,
        quantity: quantity?.trim() || null,
        checked: 0,
        sort_order: table.rows.length,
        created_at: new Date().toISOString(),
      } as Partial<ShoppingItem>);
    },
    [table]
  );

  const toggleChecked = useCallback(
    async (item: ShoppingItem) => {
      await table.update(item.id, { checked: item.checked ? 0 : 1 } as Partial<ShoppingItem>);
    },
    [table]
  );

  const removeItem = useCallback((id: number) => table.remove(id), [table]);

  const clearChecked = useCallback(async () => {
    await Promise.all(table.rows.filter((item) => item.checked).map((item) => table.remove(item.id)));
  }, [table]);

  return {
    items: table.rows,
    loading: table.loading,
    addItem,
    toggleChecked,
    removeItem,
    clearChecked,
  };
}
