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

  // Restricted to user-created rows — the built-in seed affirmations aren't meant to be edited or
  // removed individually (there's no re-seed path if one were deleted by mistake).
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
