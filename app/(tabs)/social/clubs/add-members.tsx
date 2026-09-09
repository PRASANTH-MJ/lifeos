import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, LoadingState, ScreenContainer, showAlert } from '@/components';
import { auth } from '@/firebase/config';
import { useClubInvites, useClubMembers, useInviteClubMember } from '@/modules/clubs';
import { useFollowList, usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

function FollowedRow({
  uid,
  query,
  alreadyMember,
  alreadyInvited,
  onInvite,
  inviting,
}: {
  uid: string;
  query: string;
  alreadyMember: boolean;
  alreadyInvited: boolean;
  onInvite: () => void;
  inviting: boolean;
}) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(uid);
  if (!profile) return null;
  if (query.trim() && !profile.usernameLower.includes(query.trim().toLowerCase())) return null;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Avatar url={profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
      <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
        @{profile.usernameLower}
      </Text>
      {alreadyMember ? (
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Already in club</Text>
      ) : alreadyInvited ? (
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Invited</Text>
      ) : (
        <Button label="Invite" variant="secondary" onPress={onInvite} loading={inviting} />
      )}
    </Card>
  );
}

/** Invites someone from who you already follow — a pending clubs/{clubId}/invites/{uid} doc the
 * target must accept (see modules/clubs/useClubInvites.ts) rather than adding them straight to
 * the club. Search still filters the already-loaded profile list client-side, since "who I
 * follow" is small enough for this to be simple and instant. */
export default function AddClubMembersScreen() {
  const theme = useAppTheme();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const myUid = auth.currentUser?.uid;
  const { uids: followingUids, loading: followingLoading } = useFollowList(myUid, 'following');
  const { uids: memberUids, loading: membersLoading } = useClubMembers(clubId);
  const { uids: invitedUids, loading: invitesLoading } = useClubInvites(clubId);
  const { invite, submitting } = useInviteClubMember();
  const [query, setQuery] = useState('');
  const [invitingUid, setInvitingUid] = useState<string | null>(null);

  const onInvite = async (uid: string) => {
    if (!clubId) return;
    setInvitingUid(uid);
    try {
      await invite(clubId, uid);
    } catch {
      // invite() throws on failure (not signed in, permission denied, network error) — without
      // this the rejection was unhandled and the row's button just silently reset with no
      // indication anything went wrong.
      showAlert('Could not send invite', 'Please try again.');
    } finally {
      setInvitingUid(null);
    }
  };

  const loading = followingLoading || membersLoading || invitesLoading;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          Invite people
        </Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
          Pick from people you follow — they'll get an invite to accept before joining.
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.card,
            paddingHorizontal: theme.spacing.md,
          }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search who you follow..."
            placeholderTextColor={theme.colors.textTertiary}
            style={{ paddingVertical: theme.spacing.md, color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}
          />
        </View>

        {loading ? (
          <LoadingState />
        ) : followingUids.length === 0 ? (
          <EmptyState icon="people-outline" title="You're not following anyone yet" subtitle="Follow people from Social to invite them to clubs." />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {followingUids.map((uid) => (
              <FollowedRow
                key={uid}
                uid={uid}
                query={query}
                alreadyMember={memberUids.includes(uid)}
                alreadyInvited={invitedUids.includes(uid)}
                onInvite={() => onInvite(uid)}
                inviting={submitting && invitingUid === uid}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
