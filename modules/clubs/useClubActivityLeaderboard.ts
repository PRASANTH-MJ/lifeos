import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firestore } from '@/firebase/config';
import { useProfilesByUids, type PublicProfile } from '@/modules/social';

type MemberSnapshot = { uid: string; snapshotMonth: number | null; snapshotCount: number };

export type ActivityLeaderboardRow = { uid: string; profile: PublicProfile; progress: number };

/** Encodes "this calendar month" as YYYYMM (e.g. 202609) — a plain increasing integer rather than
 * a string, so firestore.rules can enforce a snapshot only ever moves forward with a simple `>`
 * comparison instead of parsing a date string. */
function currentMonthKey(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}

/** "Most active this month" — every member's cardioLogCount delta since the start of the current
 * calendar month, same (current - snapshot) shape as a challenge's progress, just re-snapshotted
 * every month instead of once at join time. There's no server cron resetting these: whichever
 * member happens to have this leaderboard open first each month lazily rolls every stale row's
 * snapshot forward to that member's own already-public cardioLogCount (a write firestore.rules
 * lets any club member make to any other member's doc, but ONLY to replace the snapshot with that
 * uid's own current public count — see the clubs/{clubId}/members/{uid} rule). Until someone
 * views it after a month rolls over, a stale row just falls back to reading 0 progress, per the
 * `baseline` fallback below. */
export function useClubActivityLeaderboard(clubId: string | null | undefined) {
  const [members, setMembers] = useState<MemberSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(firestore, 'clubs', clubId, 'members'),
      (snapshot) => {
        setMembers(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              snapshotMonth: (data.activitySnapshotMonth as number) ?? null,
              snapshotCount: (data.activitySnapshotCount as number) ?? 0,
            };
          })
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [clubId]);

  const uids = useMemo(() => members.map((m) => m.uid), [members]);
  const { profiles, loading: profilesLoading } = useProfilesByUids(uids);

  useEffect(() => {
    if (!clubId || profilesLoading) return;
    const month = currentMonthKey();
    for (const member of members) {
      if (member.snapshotMonth === month) continue;
      const profile = profiles[member.uid];
      if (!profile) continue;
      updateDoc(doc(firestore, 'clubs', clubId, 'members', member.uid), {
        activitySnapshotMonth: month,
        activitySnapshotCount: profile.cardioLogCount,
      }).catch(() => {
        // Permission-denied is expected here for a non-member viewing a club they haven't joined
        // (the rule requires the writer be a club member) — nothing to surface to the user for it.
      });
    }
  }, [clubId, members, profiles, profilesLoading]);

  const ranked = useMemo<ActivityLeaderboardRow[]>(() => {
    const month = currentMonthKey();
    return members
      .map((member): ActivityLeaderboardRow | null => {
        const profile = profiles[member.uid];
        if (!profile) return null;
        const baseline = member.snapshotMonth === month ? member.snapshotCount : profile.cardioLogCount;
        return { uid: member.uid, profile, progress: Math.max(0, profile.cardioLogCount - baseline) };
      })
      .filter((row): row is ActivityLeaderboardRow => row !== null)
      .sort((a, b) => b.progress - a.progress);
  }, [members, profiles]);

  return { ranked, loading: loading || profilesLoading };
}
