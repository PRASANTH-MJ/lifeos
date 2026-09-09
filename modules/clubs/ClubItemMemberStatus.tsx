import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar } from '@/components';
import { useAppTheme } from '@/theme';
import { useClubItemDoneToday } from './useClubCheckins';
import { useClubMembers } from './useClubMembers';
import { useProfilesByUids } from '@/modules/social';

/** The "who's done this today" breakdown for one club habit/recurring-task row — every member's
 * live checkin status, not just the signed-in viewer's own (see useClubItemDoneToday's doc
 * comment for why that needed its own hook). Renders as a compact avatar row + "@user, @user done
 * today" line, same avatar+@username convention ClubActivityLeaderboardSection's rows use, so this
 * reads as the same kind of thing rather than a new visual idiom.
 *
 * Deliberately its own mount-gated component (see ClubHabitRow/ClubTaskRow's `expanded` state) —
 * two extra live listeners (club members + today's checkins) per item is fine for one expanded row
 * on a dedicated club screen, but would be wasteful running for every row in the compact
 * cross-club Productivity hub rollup, which never mounts this. */
export function ClubItemMemberStatus({ clubId, parent, itemId }: { clubId: string; parent: 'habits' | 'tasks'; itemId: string }) {
  const theme = useAppTheme();
  const { uids: memberUids, loading: membersLoading } = useClubMembers(clubId);
  const { uids: doneUids, loading: doneLoading } = useClubItemDoneToday(parent, clubId, itemId);
  const { profiles, loading: profilesLoading } = useProfilesByUids(doneUids);

  const loading = membersLoading || doneLoading || profilesLoading;

  return (
    <View
      style={{
        gap: theme.spacing.xs,
        paddingTop: theme.spacing.sm,
        marginTop: theme.spacing.xs,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
            {doneUids.length} of {memberUids.length || doneUids.length} done today
          </Text>
          {doneUids.length === 0 ? (
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>No one has checked in yet today.</Text>
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {doneUids.map((uid) => {
                const profile = profiles[uid];
                if (!profile) return null;
                return (
                  <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <Avatar url={profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                      @{profile.usernameLower}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}
