import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';

import type { Category, CategoryType, SpendingPriority } from './types';

type CategoryRow = { id: number; name: string; type: CategoryType; icon: string; color: string; priority: SpendingPriority };

function toCategory(row: CategoryRow): Category {
  return { id: String(row.id), name: row.name, type: row.type, icon: row.icon, color: row.color, priority: row.priority };
}

/**
 * Web build of useFinanceCategories.ts — same exported shape. Reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: any tab's write (or a sync merge) re-runs this query
 * automatically. `ORDER BY type ASC, name ASC` becomes an explicit two-key JS comparator.
 */
export function useFinanceCategories() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_categories.toArray()) as unknown as CategoryRow[];
    return [...all].sort((a, b) => {
      if (a.type !== b.type) return a.type < b.type ? -1 : 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }, []);

  const loading = rows === undefined;
  const categories = (rows ?? []).map(toCategory);

  const setCategoryPriority = useCallback(async (id: string, priority: SpendingPriority) => {
    const numericId = Number(id);
    await webDb.finance_categories.update(numericId, { priority, updated_at: new Date().toISOString() });
    await pushLocalRow('finance_categories', numericId);
  }, []);

  return { categories, loading, setCategoryPriority };
}
