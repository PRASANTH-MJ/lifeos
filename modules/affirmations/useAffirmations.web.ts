import { useCallback, useMemo } from 'react';

// Explicit .web import — '@/db' barrel resolves to the native useLocalTable.ts's QueryOptions
// (where/params/orderBy strings) for tsc's cross-file type-checking, even though Metro correctly
// bundles this file's filter/sort-based web version at runtime.
import { useLocalTable } from '@/db/useLocalTable.web';
import { dayOfYear } from '@/lib/date';
import type { Affirmation } from './types';

export function useAffirmations() {
  const table = useLocalTable<Affirmation>('affirmations', { sort: (a, b) => a.id - b.id });

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

  const editCustom = useCallback((id: number, text: string) => table.update(id, { text } as Partial<Affirmation>), [table]);
  const removeCustom = useCallback((id: number) => table.remove(id), [table]);

  return {
    affirmations: table.rows,
    loading: table.loading,
    todaysAffirmation,
    favorites,
    toggleFavorite,
    createCustom,
    editCustom,
    removeCustom,
    refresh: table.refresh,
  };
}
