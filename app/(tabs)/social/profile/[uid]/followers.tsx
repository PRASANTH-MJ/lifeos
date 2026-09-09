import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, CenteredWebColumn, EmptyState, FollowButton, LoadingState, ScreenContainer, SegmentedControl } from '@/components';
import { auth } from '@/firebase/config';
import { useFollowList, usePublicProfile, type FollowDirection } from '@/modules/social';
import { useAppTheme } from '@/theme';

export default function FollowersScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { uid, tab: initialTab } = useLocalSearchParams<{ uid: string; tab?: string }>();
  const [tab, setTab] = useState<FollowDirection>(initialTab === 'following' ? 'following' : 'followers');
  const { uids, loading } = useFollowList(uid, tab);

  return (
    <CenteredWebColumn maxWidth={480}>
    <ScreenContainer>
      <View style={{ gap: theme.spacing.lg }}>
        <SegmentedControl
          options={[
            { value: 'following', label: 'Following' },
            { value: 'followers', label: 'Followers' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {!loading && uids.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {uids.map((otherUid) => (
              <FollowRow key={otherUid} uid={otherUid} onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: otherUid } })} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
    </CenteredWebColumn>
  );
}

function FollowRow({ uid, onPress }: { uid: string; onPress: () => void }) {
  const theme = useAppTheme();
  const { profile, loading } = usePublicProfile(uid);

  if (loading || !profile) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flex: 1 }}>
        <Avatar url={profile.avatarUrl} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium, flex: 1 }}>
          @{profile.usernameLower}
        </Text>
      </Pressable>
      {uid === auth.currentUser?.uid ? null : <FollowButton targetUid={uid} />}
    </View>
  );
}
