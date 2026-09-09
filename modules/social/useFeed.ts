import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { auth, firestore } from '@/firebase/config';

import { useBlockedUsers } from './useBlockedUsers';
import type { FeedItem } from './types';

const PAGE_SIZE = 20;

/** Live view of the public feed — every public post from every user, newest first, not just
 * people the signed-in user follows. Reads `posts` directly (readable by any signed-in user, see
 * firestore.rules) rather than the personalized `users/{me}/feed` fan-out: with a small user base,
 * a follow-only feed goes empty fast, whereas "everyone's posts, most recent first" naturally
 * fills in with older posts once there's nothing newer, with no separate "not enough today"
 * fallback needed — it was never scoped to "today" in the first place.
 *
 * The `visibility == 'public'` filter is not just a convenience — Firestore denies a query
 * outright unless it can prove its security rule holds for every document the query *could*
 * match, not just the ones it returns (see useMyPosts.ts for the same reasoning); an equality
 * filter on `visibility` is what makes that provable here. Pagination grows the listener's own
 * `limit` rather than using a cursor — simpler to keep correct against a live `onSnapshot` (a
 * cursor captured from a snapshot can drift as new posts arrive above it).
 *
 * Builds each snapshot's array from a persistent id->FeedItem cache updated via `docChanges()`
 * rather than re-mapping every doc in the query on every event. This matters a lot here
 * specifically: the query is on the top-level `posts` collection, and every post's own
 * `likeCount`/`commentCount` fields live on that SAME doc (see usePostEngagement) — so every like
 * or comment on ANY visible post fires this listener, not just a genuinely new/removed post. Full
 * remapping on every event would hand the FlatList a brand-new object for every single post on
 * every like/comment anywhere in the whole public feed, defeating any per-row memoization
 * downstream (React.memo(PostCard) can't bail out if its `post` prop is a new object every time
 * even though the content didn't change). Using docChanges() instead means only the post whose
 * doc actually changed gets a new FeedItem object — every other post keeps its exact previous
 * reference, which is what lets PostCard skip re-rendering for the other N-1 posts. */
export function useFeed() {
  const [rawItems, setRawItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  // Bumped by refresh() to force the listener below to tear down and resubscribe — the feed is
  // already always live via onSnapshot, so this doesn't fetch anything new; it just gives
  // pull-to-refresh a real spinner that clears on the next snapshot, matching what a user expects
  // from the gesture instead of it being a silent no-op.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const myUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!myUid) {
      setRawItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    const q = query(collection(firestore, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE * pageCount));
    // Scoped to this one subscription (recreated whenever the effect reruns) — holds the latest
    // FeedItem per post id so an unmodified post's object survives untouched across snapshots.
    const cache = new Map<string, FeedItem>();
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') {
            cache.delete(change.doc.id);
            continue;
          }
          const data = change.doc.data();
          cache.set(change.doc.id, {
            postId: change.doc.id,
            authorUid: data.authorUid,
            authorUsernameLower: data.authorUsernameLower ?? '',
            authorAvatarUrl: data.authorAvatarUrl ?? null,
            type: data.type,
            card: data.card ?? null,
            photoUrl: data.photoUrl ?? null,
            photoUrls: data.photoUrls ?? null,
            caption: data.caption ?? null,
            workoutTemplate: data.workoutTemplate ?? null,
            createdAt: data.createdAt?.toMillis?.() ?? null,
          });
        }
        // Re-derive the ordered array from the cache on every event (order can shift), but every
        // entry for a post that wasn't in this event's docChanges() is the exact same object as
        // last time — see the doc comment above.
        setRawItems(snapshot.docs.map((d) => cache.get(d.id)!));
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );
    return unsubscribe;
  }, [myUid, pageCount, refreshNonce]);

  const { blockedUids } = useBlockedUsers();
  const items = useMemo(() => rawItems.filter((item) => !blockedUids.has(item.authorUid)), [rawItems, blockedUids]);

  const loadMore = () => setPageCount((n) => n + 1);

  const refresh = () => {
    setRefreshing(true);
    setRefreshNonce((n) => n + 1);
  };

  const removePost = async (postId: string) => {
    await deleteDoc(doc(firestore, 'posts', postId));
  };

  return { items, loading, refreshing, refresh, loadMore, removePost };
}
