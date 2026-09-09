import { useCallback } from 'react';

import { useLocalTable } from '@/db/useLocalTable.web';
import type { Category, CategoryAppliesTo } from './types';

export function useCategories(appliesTo?: 'habit' | 'task') {
  const table = useLocalTable<Category>('categories', {
    filter: appliesTo
      ? (row) => row.applies_to === appliesTo || row.applies_to === 'both'
      : undefined,
    sort: (a, b) => a.name.localeCompare(b.name),
  });

  const createCategory = useCallback(
    (values: { name: string; icon: string; color: string; appliesTo: CategoryAppliesTo }) => {
      return table.insert({
        name: values.name,
        icon: values.icon,
        color: values.color,
        applies_to: values.appliesTo,
        created_at: new Date().toISOString(),
      } as Partial<Category>);
    },
    [table]
  );

  return { categories: table.rows, loading: table.loading, createCategory, refresh: table.refresh };
}
