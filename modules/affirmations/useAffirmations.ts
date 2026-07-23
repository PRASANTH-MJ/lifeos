import { useCallback, useMemo } from 'react';

import { useLocalTable } from '@/db';
import { dayOfYear } from '@/lib/date';
import type { Affirmation } from './types';

export function useAffirmations() {
  const table = useLocalTable<Affirmation>('affirmations', { orderBy: 'id ASC' });

  const todaysAffirmation = useMemo(() => {
    if (table.rows.length === 0) return null;
    return table.rows[dayOfYear(new Date()) % table.rows.length];
  }, [table.rows]);

  const favorites = useMemo(() => table.rows.filter((affirmation) => affirmation.is_favorite), [table.rows]);

  const toggleFavorite = useCallback(
    (affirmation: Affirmation) =>
      table.update(affirmation.id, { is_favorite: affirmation.is_favorite ? 0 : 1 } as Partial<Affirmation>),
    [table]
  );

  const createCustom = useCallback(
    (text: string) =>
      table.insert({ text, is_favorite: 0, is_custom: 1, created_at: new Date().toISOString() } as Partial<Affirmation>),
    [table]
  );

  return {
    affirmations: table.rows,
    loading: table.loading,
    todaysAffirmation,
    favorites,
    toggleFavorite,
    createCustom,
    refresh: table.refresh,
  };
}
