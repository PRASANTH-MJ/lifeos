import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Category, CategoryType, SpendingPriority } from './types';

type CategoryRow = { id: number; name: string; type: CategoryType; icon: string; color: string; priority: SpendingPriority };

function toCategory(row: CategoryRow): Category {
  return { id: String(row.id), name: row.name, type: row.type, icon: row.icon, color: row.color, priority: row.priority };
}

export function useFinanceCategories() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await db.getAllAsync<CategoryRow>('SELECT * FROM finance_categories ORDER BY type ASC, name ASC');
    setCategories(rows.map(toCategory));
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setCategoryPriority = useCallback(
    async (id: string, priority: SpendingPriority) => {
      await db.runAsync('UPDATE finance_categories SET priority = ? WHERE id = ?', [priority, Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { categories, loading, setCategoryPriority };
}
