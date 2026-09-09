import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

export type ClubMessage = {
  id: string;
  authorUid: string;
  text: string;
  createdAtMs: number;
};

/** Plain-text real-time chat scoped to one club — same direct-client-write, owned-by-author shape
 * as `useUpdates`, but oldest-first (a chat reads top-down like a conversation, not newest-first
 * like a feed) and text-only, no photo attachment. */
export function useClubMessages(clubId: string | null) {
  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!clubId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, `clubs/${clubId}/messages`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              authorUid: data.authorUid ?? '',
              text: data.text ?? '',
              createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  const sendMessage = async (text: string) => {
    const uid = auth.currentUser?.uid;
    const trimmed = text.trim();
    if (!uid || !clubId || !trimmed) return;
    setSending(true);
    try {
      const messagesRef = collection(firestore, `clubs/${clubId}/messages`);
      await setDoc(doc(messagesRef), {
        authorUid: uid,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
    } finally {
      setSending(false);
    }
  };

  return { messages, loading, sending, sendMessage };
}
