import { doc, getDoc } from 'firebase/firestore';

import { firestore } from '@/firebase/config';

/** Reads the soft, advisory rate-limit counters functions/index.js's bumpRateLimitWindow writes
 * onto `users/{uid}` after every post/comment create (postRateLimit/commentRateLimit) — kept in
 * sync with that file's own window sizes. This is NOT an enforcement boundary: it's a
 * client-side check a modified client can simply skip, which is fine here because the goal is
 * only to stop an accidental burst (a double-tap, a retry loop, a bug) rather than a deliberately
 * malicious client — see firestore.rules' posts/comments create rules for the actual trust
 * boundary, which is unchanged. There's also an inherent lag: the counter only updates once the
 * trigger for the previous create has actually run, so a burst fired faster than that trigger
 * turns around can still slip a post or two past this check. */
const POST_RATE_LIMIT_MAX = 5;
const POST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const COMMENT_RATE_LIMIT_MAX = 10;
const COMMENT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

type RateLimitField = { windowStart?: { toMillis?: () => number }; count?: number } | undefined;

async function isRateLimited(uid: string, field: 'postRateLimit' | 'commentRateLimit', max: number, windowMs: number): Promise<boolean> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  const data = snap.data()?.[field] as RateLimitField;
  if (!data) return false;
  const windowStartMs = data.windowStart?.toMillis?.() ?? 0;
  const stillInWindow = Date.now() - windowStartMs < windowMs;
  return stillInWindow && (data.count ?? 0) >= max;
}

export function isPostRateLimited(uid: string): Promise<boolean> {
  return isRateLimited(uid, 'postRateLimit', POST_RATE_LIMIT_MAX, POST_RATE_LIMIT_WINDOW_MS);
}

export function isCommentRateLimited(uid: string): Promise<boolean> {
  return isRateLimited(uid, 'commentRateLimit', COMMENT_RATE_LIMIT_MAX, COMMENT_RATE_LIMIT_WINDOW_MS);
}
