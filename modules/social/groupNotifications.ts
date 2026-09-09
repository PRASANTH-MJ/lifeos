import type { SocialNotification } from './types';

export type NotificationListEntry =
  | { kind: 'single'; notification: SocialNotification }
  | { kind: 'group'; key: string; type: SocialNotification['type']; notifications: SocialNotification[] };

/** Floor a timestamp to its calendar hour — the "short window" a burst gets grouped into is
 * literally "landed in the same hour", not a rolling look-back. */
function hourBucket(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

/**
 * Purely presentational, client-side transform over useNotifications' already newest-first
 * `notifications` array — collapses a run of 2+ CONSECUTIVE same-type notifications that landed
 * in the same calendar hour under one collapsible group entry, so e.g. five "X liked your post"
 * notifications firing back-to-back don't each get their own row. Every other notification
 * (the common case — no burst) comes back as its own 'single' entry, rendering exactly as before.
 * Never touches Firestore — each notification doc, and its own read state, is untouched; this is
 * only how the list screen chooses to lay them out.
 */
export function groupNotifications(notifications: SocialNotification[]): NotificationListEntry[] {
  const entries: NotificationListEntry[] = [];
  let i = 0;
  while (i < notifications.length) {
    const current = notifications[i];
    let j = i + 1;
    if (current.createdAt != null) {
      while (
        j < notifications.length &&
        notifications[j].type === current.type &&
        notifications[j].createdAt != null &&
        hourBucket(notifications[j].createdAt!) === hourBucket(current.createdAt)
      ) {
        j += 1;
      }
    }
    const run = notifications.slice(i, j);
    if (run.length >= 2) {
      entries.push({ kind: 'group', key: `group-${current.id}`, type: current.type, notifications: run });
    } else {
      entries.push({ kind: 'single', notification: current });
    }
    i = j;
  }
  return entries;
}
