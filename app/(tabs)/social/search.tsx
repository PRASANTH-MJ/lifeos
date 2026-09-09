import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, CenteredWebColumn, EmptyState, FollowButton, LoadingState, ScreenContainer, TextField } from '@/components';
import { auth } from '@/firebase/config';
import { useSearchUsers, type PublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

export default function SocialSearchScreen() {
  const theme = useAppTheme();
  const [username, setUsername] = useState('');
  const { results, searching } = useSearchUsers(username);

  return (
    <CenteredWebColumn maxWidth={480}>
      <ScreenContainer>
        <View style={{ gap: theme.spacing.lg }}>
          <TextField
            label="Username"
            placeholder="e.g. alex_92"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoFocus
          />

          {!username.trim() ? (
            <EmptyState icon="search-outline" title="Search by username" subtitle="Start typing — matches with the most followers show up first." />
          ) : searching ? (
            <LoadingState />
          ) : results.length === 0 ? (
            <EmptyState icon="person-outline" title="No matches" subtitle="No usernames start with that." />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {results.map((profile) => (
                <SearchResultRow key={profile.uid} profile={profile} />
              ))}
            </View>
          )}
        </View>
      </ScreenContainer>
    </CenteredWebColumn>
  );
}

function SearchResultRow({ profile }: { profile: PublicProfile }) {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Pressable
        onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: profile.uid } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flex: 1 }}>
        <Avatar url={profile.avatarUrl} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
            @{profile.usernameLower}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
            {profile.followerCount} {profile.followerCount === 1 ? 'follower' : 'followers'}
          </Text>
        </View>
      </Pressable>
      {profile.uid === auth.currentUser?.uid ? null : <FollowButton targetUid={profile.uid} />}
    </View>
  );
}
