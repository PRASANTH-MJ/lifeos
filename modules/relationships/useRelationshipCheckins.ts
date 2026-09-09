import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { CheckinMode, RelationshipCheckin } from './types';

/** Every check-in logged across every person — deliberately not filtered by person here (the
 * Life Scoreboard's score needs all of them at once, see relationshipScore.ts); the relationship
 * detail screen filters this list client-side for a single person's history instead of this hook
 * taking a personId param, so there's only ever one live subscription regardless of how many
 * person rows are being viewed. */
export function useRelationshipCheckins() {
  const table = useLocalTable<RelationshipCheckin>('relationship_checkins', { orderBy: 'created_at DESC' });

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
