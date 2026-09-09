import { useCallback } from 'react';

import { useLocalTable } from '@/db';
import type { RelationshipPerson, RelationType } from './types';

/** The people you've added to track (family/partner/friend/other) — feeds the Life Scoreboard's
 * Relationship score (see relationshipScore.ts) and the check-in list (see
 * useRelationshipCheckins.ts). */
export function useRelationshipPeople() {
  const table = useLocalTable<RelationshipPerson>('relationship_people', { orderBy: 'name ASC' });

  const addPerson = useCallback(
    (values: { name: string; relation: RelationType }) => {
      const now = new Date().toISOString();
      return table.insert({ name: values.name, relation: values.relation, created_at: now, updated_at: now } as Partial<RelationshipPerson>);
    },
    [table]
  );

  // Leaves that person's past check-ins in place rather than cascading the delete — they're
  // harmless (computeRelationshipScore only ever iterates `people`, so an orphaned check-in for a
  // removed person is simply never read again) and keeping them avoids a second table's worth of
  // sync/tombstone bookkeeping for what's a rare, low-stakes action.
  const removePerson = useCallback((id: number) => table.remove(id), [table]);

  return { people: table.rows, loading: table.loading, addPerson, removePerson };
}
