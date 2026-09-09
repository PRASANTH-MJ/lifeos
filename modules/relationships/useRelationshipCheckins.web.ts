import { useCallback, useMemo } from 'react';

// Explicit .web import — see useJournal.web.ts's identical comment for why.
import { useLocalTable } from '@/db/useLocalTable.web';
import type { CheckinMode, RelationshipCheckin } from './types';

/** Web build of useRelationshipCheckins.ts — same exported shape. `ORDER BY created_at DESC`
 * becomes a JS comparator passed to useLocalTable.web.ts. */
export function useRelationshipCheckins() {
  const sort = useMemo(() => (a: RelationshipCheckin, b: RelationshipCheckin) => b.created_at.localeCompare(a.created_at), []);
  const table = useLocalTable<RelationshipCheckin>('relationship_checkins', { sort });

  const addCheckin = useCallback(
    (personId: number, options: { mode: CheckinMode; durationMinutes: number | null; note?: string | null }) => {
      const now = new Date().toISOString();
      return table.insert({
        person_id: personId,
        note: options.note ?? null,
        mode: options.mode,
        duration_minutes: options.durationMinutes,
        created_at: now,
        updated_at: now,
      } as Partial<RelationshipCheckin>);
    },
    [table]
  );

  return { checkins: table.rows, loading: table.loading, addCheckin };
}
