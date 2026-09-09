import { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, Button, Card, EmptyState, LoadingState } from '@/components';
import { useAppTheme } from '@/theme';
import { useClubActivityLeaderboard, type ActivityLeaderboardRow } from './useClubActivityLeaderboard';
import { useClubMembers } from './useClubMembers';
import { useRemoveClubMember } from './useRemoveClubMember';
import { useSetClubAdminRole } from './useSetClubAdminRole';
import { useSetClubSubAdminRole } from './useSetClubSubAdminRole';
import { useProfilesByUids, type PublicProfile } from '@/modules/social';
import type { Club } from './types';

type MemberAdminCapabilities = {
  isFullAdmin: boolean;
  isSubAdmin: boolean;
  canManageAdmin: boolean;
  canManageSubAdmin: boolean;
  canRemove: boolean;
};

/** Pure who-can-do-what-to-whom computation, pulled out of the old MemberAdminActions so the
 * parent row can decide (without rendering anything) whether to even show a "manage member"
 * expand affordance in the first place — see MemberActionsToggle below. */
function getMemberAdminCapabilities({
  uid,
  createdBy,
  admins,
  subAdmins,
  viewerIsAdmin,
  viewerIsSubAdmin,
  viewerUid,
}: {
  uid: string;
  createdBy: string;
  admins: string[];
  subAdmins: string[];
  viewerIsAdmin: boolean;
  viewerIsSubAdmin: boolean;
  viewerUid: string | undefined;
}): MemberAdminCapabilities {
  const isCreator = uid === createdBy;
  const isFullAdmin = !isCreator && admins.includes(uid);
  const isSubAdmin = subAdmins.includes(uid);
  const isSelf = uid === viewerUid;

  // Full admin ("Make admin"/"Remove admin") and sub-admin ("Make sub-admin"/"Remove sub-admin")
  // role changes are FULL-admin-only actions — a sub-admin can't touch roles at all.
  const canManageAdmin = viewerIsAdmin && !isSelf && !isCreator;
  const canManageSubAdmin = viewerIsAdmin && !isSelf && !isCreator && !isFullAdmin;
  // Removing a member is the moderation action both tiers get, with a sub-admin capped at
  // ordinary members: they can't remove another sub-admin or a full admin (see removeClubMember).
  const canRemove = (viewerIsAdmin || viewerIsSubAdmin) && !isSelf && !isCreator && !isFullAdmin && (viewerIsAdmin || !isSubAdmin);

  return { isFullAdmin, isSubAdmin, canManageAdmin, canManageSubAdmin, canRemove };
}

/** The promote/demote/remove action row a club admin/sub-admin sees under a member's row — moved
 * out of [clubId].tsx's old standalone MemberRow so both this section's ranked and plain render
 * modes can show the exact same admin controls, not just the leaderboard-gated one. Role-change
 * logic (who can do what to whom) is unchanged from the original MemberRow; it now takes the
 * already-computed capabilities (see getMemberAdminCapabilities) instead of recomputing them,
 * since MemberActionsToggle below needs that same result just to decide whether to show its
 * expand affordance at all. */
function MemberAdminActions({ uid, clubId, caps }: { uid: string; clubId: string; caps: MemberAdminCapabilities }) {
  const theme = useAppTheme();
  const { setAdmin, submitting: settingAdmin } = useSetClubAdminRole();
  const { setSubAdmin, submitting: settingSubAdmin } = useSetClubSubAdminRole();
  const { removeMember, submitting: removing } = useRemoveClubMember();
  const { isFullAdmin, isSubAdmin, canManageAdmin, canManageSubAdmin, canRemove } = caps;

  if (!canManageAdmin && !canManageSubAdmin && !canRemove) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
      {canManageAdmin ? (
        <Button
          label={isFullAdmin ? 'Remove admin' : 'Make admin'}
          variant="secondary"
          onPress={() => setAdmin(clubId, uid, !isFullAdmin)}
          loading={settingAdmin}
        />
      ) : null}
      {canManageSubAdmin ? (
        <Button
          label={isSubAdmin ? 'Remove sub-admin' : 'Make sub-admin'}
          variant="secondary"
          onPress={() => setSubAdmin(clubId, uid, !isSubAdmin)}
          loading={settingSubAdmin}
        />
      ) : null}
      {canRemove ? <Button label="Remove" variant="danger" onPress={() => removeMember(clubId, uid)} loading={removing} /> : null}
    </View>
  );
}

/** Tap-to-expand wrapper around MemberAdminActions — mirrors ClubHabitRow/ClubTaskRow's
 * `showMemberStatus` chevron-expand convention (same chevron icon, same label styling, same
 * collapsed-by-default behavior) so admin controls no longer clutter every member row by default;
 * tapping the row reveals the small action menu, tapping again collapses it. Renders nothing at
 * all (not even the chevron) when the viewer has no actions available for this member, matching
 * the old MemberAdminActions' own "render nothing" fallback. */
function MemberActionsToggle({ uid, clubId, caps }: { uid: string; clubId: string; caps: MemberAdminCapabilities }) {
  const theme = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const hasActions = caps.canManageAdmin || caps.canManageSubAdmin || caps.canRemove;

  if (!hasActions) return null;

  return (
    <>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textTertiary} />
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
          Manage member
        </Text>
      </Pressable>
      {expanded ? <MemberAdminActions uid={uid} clubId={clubId} caps={caps} /> : null}
    </>
  );
}

type ViewerRole = { viewerIsAdmin: boolean; viewerIsSubAdmin: boolean };

/** One "Club Members" row in the plain (unranked, no-challenge) mode below. Takes its `profile`
 * as a prop (resolved once, for every member at once, by the section below via
 * `useProfilesByUids`) rather than each row opening its own `usePublicProfile` listener — a club
 * with N members used to mean N separate profile listeners just for this list; see
 * useProfilesByUids's own doc comment for how that's now batched into ~1 per 30 members.
 *
 * Wrapped in `memo` so that when one OTHER member's profile listener fires, only that member's row
 * re-renders — `useProfilesByUids` preserves object identity for every uid whose data didn't
 * change (via `docChanges()`), so this row's own `profile`/`club` props stay referentially equal
 * and `memo`'s default shallow comparison correctly bails out for every unaffected row. */
const PlainMemberRow = memo(function PlainMemberRow({
  uid,
  clubId,
  myUid,
  club,
  viewer,
  profile,
}: {
  uid: string;
  clubId: string;
  myUid: string | undefined;
  club: Pick<Club, 'admins' | 'subAdmins' | 'createdBy'>;
  viewer: ViewerRole;
  profile: PublicProfile | undefined;
}) {
  const theme = useAppTheme();
  if (!profile) return null;

  const isAdmin = uid === club.createdBy || club.admins.includes(uid);
  const isSubAdmin = !isAdmin && club.subAdmins.includes(uid);
  const caps = getMemberAdminCapabilities({
    uid,
    createdBy: club.createdBy,
    admins: club.admins,
    subAdmins: club.subAdmins,
    viewerIsAdmin: viewer.viewerIsAdmin,
    viewerIsSubAdmin: viewer.viewerIsSubAdmin,
    viewerUid: myUid,
  });

  return (
    <Card
      style={{
        gap: theme.spacing.sm,
        ...(uid === myUid ? { borderColor: theme.colors.primary } : null),
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar url={profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            @{profile.usernameLower}
          </Text>
          {isAdmin || isSubAdmin ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{isAdmin ? 'Admin' : 'Sub-admin'}</Text>
          ) : null}
        </View>
      </View>
      <MemberActionsToggle uid={uid} clubId={clubId} caps={caps} />
    </Card>
  );
});

/** One ranked leaderboard row (rank number + activity count) — split out of the inline `.map()`
 * below and wrapped in `memo` for the same reason as PlainMemberRow above: `useClubActivityLeaderboard`
 * ultimately reads its profiles via the now-batched `useProfilesByUids`, which preserves a
 * PublicProfile object's identity across updates to OTHER members, so this row can skip
 * re-rendering when a different member's row changed. */
const RankedMemberRow = memo(function RankedMemberRow({
  row,
  index,
  clubId,
  myUid,
  club,
  viewerIsAdmin,
  viewerIsSubAdmin,
}: {
  row: ActivityLeaderboardRow;
  index: number;
  clubId: string;
  myUid: string | undefined;
  club: Pick<Club, 'admins' | 'subAdmins' | 'createdBy'>;
  viewerIsAdmin: boolean;
  viewerIsSubAdmin: boolean;
}) {
  const theme = useAppTheme();
  const isAdmin = row.uid === club.createdBy || club.admins.includes(row.uid);
  const isSubAdmin = !isAdmin && club.subAdmins.includes(row.uid);
  const caps = getMemberAdminCapabilities({
    uid: row.uid,
    createdBy: club.createdBy,
    admins: club.admins,
    subAdmins: club.subAdmins,
    viewerIsAdmin,
    viewerIsSubAdmin,
    viewerUid: myUid,
  });

  return (
    <Card
      style={{
        gap: theme.spacing.sm,
        ...(row.uid === myUid ? { borderColor: theme.colors.primary } : null),
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Text style={{ width: 20, color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
          {index + 1}
        </Text>
        <Avatar url={row.profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            @{row.profile.usernameLower}
          </Text>
          {isAdmin || isSubAdmin ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{isAdmin ? 'Admin' : 'Sub-admin'}</Text>
          ) : null}
        </View>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
          {row.progress} this month
        </Text>
      </View>
      <MemberActionsToggle uid={row.uid} clubId={clubId} caps={caps} />
    </Card>
  );
});

/** The club detail screen's single member-list section — two render modes sharing one title/
 * layout so there's never both a leaderboard AND a separate "Club Members" list on screen at
 * once (see the duplicate-roster bug report). When `hasChallenge` is true it's the ranked "most
 * active this month" leaderboard (rank number + activity count, sorted by activity descending —
 * the ranking is challenge-driven, so it only makes sense to show once a challenge exists); when
 * false it falls back to a plain unranked roster (avatar/@username/role only), reusing
 * useClubMembers instead of the leaderboard's snapshot-delta data, which has no meaning without a
 * challenge motivating it. Both modes keep the exact same admin/sub-admin promote/demote/remove
 * controls the old separate "Club Members" list had (see MemberAdminActions) — merging the two
 * sections was only ever about not showing the same people twice, not about dropping moderation.
 * There's no per-member last-activity timestamp anywhere in this data model (see
 * useClubActivityLeaderboard's cardioLogCount-delta shape), so the per-row stat in ranked mode
 * stays the real activity count rather than a fabricated "Active 2h ago"-style label. */
export function ClubActivityLeaderboardSection({
  clubId,
  myUid,
  club,
  hasChallenge,
  viewerIsAdmin = false,
  viewerIsSubAdmin = false,
  title = 'Most active this month',
  plainTitle = 'Club Members',
}: {
  clubId: string;
  myUid: string | undefined;
  club: Pick<Club, 'admins' | 'subAdmins' | 'createdBy'>;
  /** Whether the club has at least one challenge (active or not) — gates ranked vs. plain mode. */
  hasChallenge: boolean;
  /** The signed-in viewer's own role — only needed to show admin/sub-admin moderation controls
   * (see MemberAdminActions); omit on a read-only preview (e.g. the discovery hub's card) where
   * those controls should never show. */
  viewerIsAdmin?: boolean;
  viewerIsSubAdmin?: boolean;
  title?: string;
  plainTitle?: string;
}) {
  const theme = useAppTheme();
  const { ranked, loading: rankedLoading } = useClubActivityLeaderboard(hasChallenge ? clubId : null);
  const { uids, loading: membersLoading } = useClubMembers(hasChallenge ? null : clubId);
  // One batched call for every plain-mode row's profile (see useProfilesByUids — chunked
  // `in`-queries, not one listener per member) instead of each PlainMemberRow mounting its own
  // usePublicProfile. Only runs in plain (no-challenge) mode; ranked mode already gets its
  // profiles this same batched way via useClubActivityLeaderboard.
  const { profiles: plainProfiles, loading: plainProfilesLoading } = useProfilesByUids(hasChallenge ? [] : uids);

  if (!hasChallenge) {
    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
          {plainTitle}
        </Text>
        {membersLoading || plainProfilesLoading ? (
          <LoadingState />
        ) : uids.length === 0 ? (
          <EmptyState icon="people-outline" title="No members yet" subtitle="Be the first to invite someone to join." />
        ) : (
          uids.map((uid) => (
            <PlainMemberRow
              key={uid}
              uid={uid}
              clubId={clubId}
              myUid={myUid}
              club={club}
              viewer={{ viewerIsAdmin, viewerIsSubAdmin }}
              profile={plainProfiles[uid]}
            />
          ))
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>{title}</Text>
      {rankedLoading ? (
        <LoadingState />
      ) : ranked.length === 0 ? (
        <EmptyState icon="flash-outline" title="No activity yet" subtitle="Log a cardio session to appear on this leaderboard." />
      ) : (
        ranked.map((row, index) => (
          <RankedMemberRow
            key={row.uid}
            row={row}
            index={index}
            clubId={clubId}
            myUid={myUid}
            club={club}
            viewerIsAdmin={viewerIsAdmin}
            viewerIsSubAdmin={viewerIsSubAdmin}
          />
        ))
      )}
    </View>
  );
}
