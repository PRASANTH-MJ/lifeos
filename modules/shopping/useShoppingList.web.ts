import { useCallback, useMemo } from 'react';

import { useLocalTable } from '@/db/useLocalTable.web';
import { itemLineTotal } from './quantity';
import type { ShoppingItem, ShoppingUnit } from './types';

function itemTotal(item: ShoppingItem): number {
  return itemLineTotal(item.price, item.quantity, item.unit);
}

/**
 * Web build of useShoppingList.ts — same exported shape. Reactive via useLocalTable.web.ts's
 * useLiveQuery wrapper: a write from any tab (or the sync engine) re-runs this query
 * automatically, so no manual refresh() is needed (kept as a no-op for callers that await it).
 *
 * SQL `WHERE list_id = ?` -> a filter predicate; `ORDER BY checked ASC, sort_order ASC,
 * created_at ASC` -> the equivalent multi-key comparator below.
 */
export function useShoppingList(listId: number) {
  const filter = useCallback((row: ShoppingItem) => row.list_id === listId, [listId]);
  const sort = useCallback((a: ShoppingItem, b: ShoppingItem) => {
    const checkedDiff = (a.checked ? 1 : 0) - (b.checked ? 1 : 0);
    if (checkedDiff !== 0) return checkedDiff;
    const sortOrderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortOrderDiff !== 0) return sortOrderDiff;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  }, []);

  const table = useLocalTable<ShoppingItem>('shopping_items', { filter, sort });

  const addItem = useCallback(
    async (name: string, quantity?: string | null, price?: number | null, unit?: ShoppingUnit | null, notes?: string | null) => {
      await table.insert({
        list_id: listId,
        name,
        quantity: quantity?.trim() || '1',
        unit: unit ?? 'pcs',
        price: price ?? null,
        notes: notes?.trim() || null,
        checked: 0,
        sort_order: table.rows.length,
        created_at: new Date().toISOString(),
      } as Partial<ShoppingItem>);
    },
    [table, listId]
  );

  const toggleChecked = useCallback(
    async (item: ShoppingItem) => {
      await table.update(item.id, { checked: item.checked ? 0 : 1 } as Partial<ShoppingItem>);
    },
    [table]
  );

  const updateItem = useCallback(
    async (id: number, values: { name: string; quantity?: string | null; price?: number | null; unit?: ShoppingUnit | null; notes?: string | null }) => {
      await table.update(id, {
        name: values.name,
        quantity: values.quantity?.trim() || '1',
        price: values.price ?? null,
        unit: values.unit ?? 'pcs',
        notes: values.notes?.trim() || null,
      } as Partial<ShoppingItem>);
    },
    [table]
  );

  const removeItem = useCallback((id: number) => table.remove(id), [table]);

  const clearChecked = useCallback(async () => {
    await Promise.all(table.rows.filter((item) => item.checked).map((item) => table.remove(item.id)));
  }, [table]);

  // "Overall" is every item's price × quantity added up; "remaining" is the
  // same but only for items not yet checked off — checking an item off
  // subtracts its total from what's left to spend.
  const overallTotal = useMemo(() => table.rows.reduce((sum, item) => sum + itemTotal(item), 0), [table.rows]);
  const remainingTotal = useMemo(
    () => table.rows.filter((item) => !item.checked).reduce((sum, item) => sum + itemTotal(item), 0),
    [table.rows]
  );

  return {
    items: table.rows,
    loading: table.loading,
    refresh: table.refresh,
    addItem,
    updateItem,
    toggleChecked,
    removeItem,
    clearChecked,
    overallTotal,
    remainingTotal,
    itemTotal,
  };
}
