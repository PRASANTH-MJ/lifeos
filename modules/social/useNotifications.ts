import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

import type { SocialNotification } from './types';

/** The signed-in user's own notification inbox ("X started following you", "X liked your post",
 * "X commented on your post") — written only by followUser/onLikeCreated/onCommentCreated (Admin
 * SDK, see functions/index.js), same owner-read-only shape as feed/likedPosts. Marking read is the
 * one thing the client does directly (firestore.rules allows toggling only that field). */
export function useNotifications() {
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'users', myUid, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type: data.type,
              fromUid: data.fromUid,
              postId: data.postId ?? null,
              message: data.message ?? null,
              read: !!data.read,
              createdAt: data.createdAt?.toMillis?.() ?? null,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [myUid]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markRead = (notificationId: string) => {
    if (!myUid) return;
    updateDoc(doc(firestore, 'users', myUid, 'notifications', notificationId), { read: true }).catch(() => {});
  };

  const markAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id));
  };

  return { notifications, loading, unreadCount, markRead, markAllRead };
}
