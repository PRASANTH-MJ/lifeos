import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import type { Category, CategoryType } from './types';

type CategoryRow = { id: number; name: string; type: CategoryType; icon: string; color: string };

function toCategory(row: CategoryRow): Category {
  return { id: String(row.id), name: row.name, type: row.type, icon: row.icon, color: row.color };
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categories, loading };
}
