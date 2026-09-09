import { useCallback, useMemo } from 'react';

// Explicit .web import — see useJournal.web.ts's identical comment for why.
import { useLocalTable } from '@/db/useLocalTable.web';
import type { RelationshipPerson, RelationType } from './types';

/** Web build of useRelationshipPeople.ts — same exported shape. `ORDER BY name ASC` becomes a JS
 * comparator passed to useLocalTable.web.ts. */
export function useRelationshipPeople() {
  const sort = useMemo(() => (a: RelationshipPerson, b: RelationshipPerson) => a.name.localeCompare(b.name), []);
  const table = useLocalTable<RelationshipPerson>('relationship_people', { sort });

  const addPerson = useCallback(
    (values: { name: string; relation: RelationType }) => {
      const now = new Date().toISOString();
      return table.insert({ name: values.name, relation: values.relation, created_at: now, updated_at: now } as Partial<RelationshipPerson>);
    },
    [table]
  );

  const removePerson = useCallback((id: number) => table.remove(id), [table]);

  return { people: table.rows, loading: table.loading, addPerson, removePerson };
}
