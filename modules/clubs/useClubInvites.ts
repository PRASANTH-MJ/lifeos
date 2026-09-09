import { collection, collectionGroup, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { auth, firestore, functions } from '@/firebase/config';

export type ClubInvite = { clubId: string; uid: string; invitedBy: string };

/** Pending invites for one club — lets add-members.tsx show "Invited" instead of "Invite" for
 * someone already invited but not yet accepted. */
export function useClubInvites(clubId: string | null | undefined) {
  const [uids, setUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setUids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'clubs', clubId, 'invites'),
      (snapshot) => {
        setUids(snapshot.docs.map((d) => d.id));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  return { uids, loading };
}

/** Invites someone the caller follows into a club instead of adding them directly — creates a
 * pending clubs/{clubId}/invites/{uid} doc the target must accept. Direct client write (no
 * shared counter touched), gated by firestore.rules requiring the caller already be a club
 * member — same "simple doc, no callable needed" shape as the challenge/event `updates`
 * subcollections. */
export function useInviteClubMember() {
  const [submitting, setSubmitting] = useState(false);

  const invite = async (clubId: string, uid: string): Promise<void> => {
    const myUid = auth.currentUser?.uid;
    if (!myUid) throw new Error('Sign in required.');
    setSubmitting(true);
    try {
      await setDoc(doc(firestore, 'clubs', clubId, 'invites', uid), { uid, invitedBy: myUid, invitedAt: serverTimestamp() });
    } finally {
      setSubmitting(false);
    }
  };

  return { invite, submitting };
}

/** Every club invite addressed to the signed-in user, across all clubs — a collectionGroup query
 * over every clubs/{clubId}/invites subcollection, filtered to this uid. Surfaced as a small
 * "Club invites" section on the clubs index screen (this app's notifications screen is scoped to
 * follow/like/comment types, so a dedicated section here is simpler than threading a new type
 * through it). */
export function useMyClubInvites() {
  const myUid = auth.currentUser?.uid;
  const [invites, setInvites] = useState<ClubInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collectionGroup(firestore, 'invites'), where('uid', '==', myUid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setInvites(
          snapshot.docs.map((d) => ({
            clubId: d.ref.parent.parent?.id ?? '',
            uid: d.id,
            invitedBy: (d.data().invitedBy as string) ?? '',
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [myUid]);

  return { invites, loading };
}

/** Accepting calls joinClub (the same callable the club detail screen's "Join" button uses) so
 * membership stays a single atomic pairing, then clears the invite doc; declining just deletes
 * it. */
export function useRespondToClubInvite() {
  const [submitting, setSubmitting] = useState(false);

  const accept = async (clubId: string): Promise<void> => {
    const myUid = auth.currentUser?.uid;
    if (!myUid) throw new Error('Sign in required.');
    setSubmitting(true);
    try {
      const fn = httpsCallable<{ clubId: string }, { joined: boolean }>(functions, 'joinClub');
      await fn({ clubId });
      await deleteDoc(doc(firestore, 'clubs', clubId, 'invites', myUid));
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async (clubId: string): Promise<void> => {
    const myUid = auth.currentUser?.uid;
    if (!myUid) throw new Error('Sign in required.');
    setSubmitting(true);
    try {
      await deleteDoc(doc(firestore, 'clubs', clubId, 'invites', myUid));
    } finally {
      setSubmitting(false);
    }
  };

  return { accept, decline, submitting };
}
