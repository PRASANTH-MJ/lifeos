import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';
import type { Club } from './types';

/** Which of the already-loaded `clubs` (from useClubs, which already includes every club the
 * signed-in user can read — including their own private/invite-only memberships, per
 * firestore.rules' clubs/{clubId} read rule) the signed-in user is actually a member of. One
 * membership-doc listener per club rather than a collectionGroup query, since clubs/{id}/members/
 * {uid} docs carry no `uid` field to filter a collectionGroup query on (the doc id IS the uid) —
 * fine at this app's scale, same one-listener-per-item shape as useFollow. Ordering is preserved
 * from `clubs` (memberCount desc), so myClubs[0] is the caller's own biggest club. */
export function useMyClubs(clubs: Club[]): { myClubs: Club[]; loading: boolean } {
  const myUid = auth.currentUser?.uid;
  const [memberOf, setMemberOf] = useState<Record<string, boolean>>({});
  const clubIds = clubs.map((c) => c.id).join(',');

  useEffect(() => {
    if (!myUid || clubs.length === 0) {
      setMemberOf({});
      return;
    }
    const unsubscribes = clubs.map((club) =>
      onSnapshot(
        doc(firestore, 'clubs', club.id, 'members', myUid),
        (snap) => setMemberOf((current) => ({ ...current, [club.id]: snap.exists() })),
        () => {}
      )
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    // clubIds captures the same identity clubs.map(...).join(',') would, without re-running this
    // effect (and re-subscribing every club) on every parent render just because `clubs` is a new
    // array reference with the same members.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid, clubIds]);

  const myClubs = clubs.filter((club) => memberOf[club.id]);
  const loading = !!myUid && clubs.length > 0 && Object.keys(memberOf).length < clubs.length;
  return { myClubs, loading };
}
