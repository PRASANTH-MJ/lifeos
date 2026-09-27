import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { Avatar, Button, CenteredWebColumn, EmptyState, FollowButton, IconBadge, LoadingState, PostCard, ScreenContainer, SegmentedControl, TextField, showAlert } from '@/components';
import { auth } from '@/firebase/config';
import { uploadAvatar } from '@/modules/profile/avatarSync';
import { useBlockedUsers, usePublicProfile, useUsernameSetup, useUserPosts, useLikedPosts, type Post } from '@/modules/social';
import { useAppTheme } from '@/theme';

type Trophy = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

/** Milestones earned from data already tracked elsewhere in the app. habitStreak/cardioLogCount
 * come from the viewed profile's own denormalized copy of that (otherwise local, per-device)
 * data — see usePublicProfileStatsSync — so this works the same for your own profile and anyone
 * else's, not just isMe. */
function computeTrophies({
  postCount,
  followerCount,
  habitStreak,
  cardioLogCount,
  cardioStreak,
}: {
  postCount: number;
  followerCount: number;
  habitStreak: number;
  cardioLogCount: number;
  cardioStreak: number;
}): Trophy[] {
  const trophies: Trophy[] = [];
  if (postCount >= 1) trophies.push({ key: 'first-post', label: 'First Post', icon: 'create' });
  if (postCount >= 10) trophies.push({ key: 'ten-posts', label: '10 Posts', icon: 'images' });
  if (followerCount >= 100) trophies.push({ key: 'hundred-followers', label: '100 Followers', icon: 'people' });
  if (habitStreak >= 7) trophies.push({ key: 'streak-7', label: '7-Day Streak', icon: 'flame' });
  if (habitStreak >= 30) trophies.push({ key: 'streak-30', label: '30-Day Streak', icon: 'flame' });
  if (habitStreak >= 100) trophies.push({ key: 'streak-100', label: '100-Day Streak', icon: 'flame' });
  if (cardioLogCount >= 1) trophies.push({ key: 'first-activity', label: 'First Activity', icon: 'walk' });
  if (cardioLogCount >= 50) trophies.push({ key: 'fifty-activities', label: '50 Activities', icon: 'trophy' });
  if (cardioLogCount >= 100) trophies.push({ key: 'hundred-activities', label: '100 Activities', icon: 'trophy' });
  if (cardioStreak >= 7) trophies.push({ key: 'cardio-streak-7', label: '7-Day Activity Streak', icon: 'flame' });
  if (cardioStreak >= 30) trophies.push({ key: 'cardio-streak-30', label: '30-Day Activity Streak', icon: 'flame' });
  if (cardioStreak >= 100) trophies.push({ key: 'cardio-streak-100', label: '100-Day Activity Streak', icon: 'flame' });
  return trophies;
}

type Tab = 'grid' | 'liked';

export default function SocialProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const myUid = auth.currentUser?.uid;
  const isMe = uid === myUid;
  const { profile, loading } = usePublicProfile(uid);
  const { posts, loading: postsLoading, removePost } = useUserPosts(uid);
  const { blockedUids, blockUser, unblockUser } = useBlockedUsers();
  const isBlocked = blockedUids.has(uid);
  const { posts: likedPosts, loading: likedLoading } = useLikedPosts(isMe ? uid : null);
  const trophies = profile
    ? computeTrophies({
        postCount: profile.postCount,
        followerCount: profile.followerCount,
        habitStreak: profile.habitStreak,
        cardioLogCount: profile.cardioLogCount,
        cardioStreak: profile.cardioStreak,
      })
    : [];
  const [tab, setTab] = useState<Tab>('grid');
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer>
        <EmptyState icon="person-outline" title="Profile not found" subtitle="This person hasn't set up a social profile." />
      </ScreenContainer>
    );
  }

  const confirmDelete = (postId: string) => {
    showAlert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removePost(postId);
          setOpenPost(null);
        },
      },
    ]);
  };

  const onShareProfile = () => {
    Share.share({ message: `Follow me on Flowsy: @${profile.usernameLower}` });
  };

  const onToggleBlock = () => {
    if (isBlocked) {
      showAlert('Unblock user?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblockUser(uid) },
      ]);
      return;
    }
    showAlert('Block user?', "You won't see their posts in your feed anymore.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => blockUser(uid) },
    ]);
  };

  const shownPosts = tab === 'grid' ? posts : likedPosts;
  const shownLoading = tab === 'grid' ? postsLoading : likedLoading;

  return (
    <CenteredWebColumn>
    <ScreenContainer scroll={!openPost}>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          {isMe ? (
            <Pressable onPress={() => setEditVisible(true)} accessibilityLabel="Add a profile photo">
              <Avatar url={profile.avatarUrl} size="lg" color={theme.colors.primary} />
            </Pressable>
          ) : (
            <Avatar url={profile.avatarUrl} size="lg" color={theme.colors.primary} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {profile.displayName}
            </Text>
            {profile.isPro ? (
              <View style={{ backgroundColor: theme.colors.textPrimary, borderRadius: theme.radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: theme.colors.background, fontSize: 10, fontWeight: theme.typography.weight.bold }}>PRO</Text>
              </View>
            ) : null}
          </View>
          {profile.bio ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center' }}>{profile.bio}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.sm }}>
            <Stat label="Posts" value={profile.postCount} />
            <Stat
              label="Followers"
              value={profile.followerCount}
              onPress={() => router.push({ pathname: '/social/profile/[uid]/followers', params: { uid, tab: 'followers' } })}
            />
            <Stat
              label="Following"
              value={profile.followingCount}
              onPress={() => router.push({ pathname: '/social/profile/[uid]/followers', params: { uid, tab: 'following' } })}
            />
            <Stat label="Streak" value={profile.habitStreak} />
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm, width: '100%', maxWidth: 400 }}>
            {isMe ? (
              <View style={{ flex: 1 }}>
                <Button label="Edit Profile" variant="secondary" onPress={() => setEditVisible(true)} />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <FollowButton targetUid={uid} />
              </View>
            )}
            <Pressable
              onPress={onShareProfile}
              hitSlop={8}
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="share-outline" size={20} color={theme.colors.textSecondary} />
            </Pressable>
            {!isMe ? (
              <Pressable
                onPress={onToggleBlock}
                accessibilityLabel={isBlocked ? 'Unblock user' : 'Block user'}
                hitSlop={8}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={isBlocked ? 'person-add-outline' : 'person-remove-outline'} size={20} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {trophies.length > 0 ? <TrophyCase trophies={trophies} /> : null}

        {isMe ? (
          <SegmentedControl
            options={[
              { value: 'grid', label: 'Posts' },
              { value: 'liked', label: 'Liked' },
            ]}
            value={tab}
            onChange={setTab}
          />
        ) : null}

        {!shownLoading && shownPosts.length === 0 ? (
          <EmptyState icon="images-outline" title={tab === 'grid' ? 'No posts yet' : 'No liked posts yet'} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {shownPosts.map((post) => (
              <PostThumbnail key={post.id} post={post} onPress={() => setOpenPost(post)} />
            ))}
          </View>
        )}
      </View>

      <Modal visible={!!openPost} animationType="slide" onRequestClose={() => setOpenPost(null)}>
        <ScreenContainer edges={['top', 'bottom']}>
          <Pressable onPress={() => setOpenPost(null)} hitSlop={8} style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.md }}>
            <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
          </Pressable>
          {openPost ? (
            <View style={{ alignItems: 'center' }}>
              <PostCard post={openPost} onDelete={isMe ? () => confirmDelete(openPost.id) : undefined} />
            </View>
          ) : null}
        </ScreenContainer>
      </Modal>

      {isMe ? <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={profile} /> : null}
    </ScreenContainer>
    </CenteredWebColumn>
  );
}

function PostThumbnail({ post, onPress }: { post: Post; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel="Open post" style={{ width: '33.333%', aspectRatio: 1, padding: 1 }}>
      {post.photoUrl ? (
        <Image source={{ uri: post.photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : post.card ? (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: theme.spacing.xs,
          }}>
          <Ionicons name={post.card.icon} size={18} color={post.card.accentColor} />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.bold }}>
            {post.card.value}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: 9 }} numberOfLines={1}>
            {post.card.valueLabel}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.xs,
          }}>
          <Ionicons name="chatbox-outline" size={16} color={theme.colors.textTertiary} />
          <Text style={{ color: theme.colors.textSecondary, fontSize: 10, textAlign: 'center' }} numberOfLines={3}>
            {post.caption}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EditProfileModal({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: { displayName: string; bio: string | null; usernameLower: string; avatarUrl: string | null };
}) {
  const theme = useAppTheme();
  const myUid = auth.currentUser?.uid;
  const { claimUsername, submitting } = useUsernameSetup();
  const [bio, setBio] = useState(profile.bio ?? '');
  const [username, setUsername] = useState(profile.usernameLower);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(profile.avatarUrl);
  const [pendingLocalAvatarUri, setPendingLocalAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickAvatar = async () => {
    // No permission request needed — see app/(tabs)/settings/index.tsx's onPickAvatar for why.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setAvatarPreviewUri(result.assets[0].uri);
      setPendingLocalAvatarUri(result.assets[0].uri);
    }
  };

  const onSave = async () => {
    setError(null);
    // A freshly-picked photo needs uploading to Storage first — claimUsername always overwrites
    // userPublicProfiles' avatarUrl with whatever's passed here, so an unchanged photo still needs
    // its existing URL passed through, or saving a name/bio edit would silently wipe the avatar.
    let avatarUrl = profile.avatarUrl;
    if (pendingLocalAvatarUri && myUid) {
      setUploadingAvatar(true);
      try {
        avatarUrl = await uploadAvatar(myUid, pendingLocalAvatarUri);
      } catch {
        setUploadingAvatar(false);
        setError('Could not upload photo. Please try again.');
        return;
      }
      setUploadingAvatar(false);
    }
    // No separate "display name" concept — the username is the name, everywhere (feed, profile
    // header, search). Renaming your username here renames what's shown as your name too.
    const result = await claimUsername({
      username: username.trim(),
      displayName: username.trim(),
      bio: bio.trim() || undefined,
      avatarUrl,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenContainer edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
          </Pressable>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            Edit Profile
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Pressable onPress={onPickAvatar} accessibilityLabel="Change profile photo">
              <Avatar url={avatarPreviewUri} size="lg" color={theme.colors.primary} />
            </Pressable>
            <Pressable onPress={onPickAvatar}>
              <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Change photo
              </Text>
            </Pressable>
          </View>
          <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextField label="Bio" value={bio} onChangeText={setBio} multiline />
          {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}
          <Button label="Save" onPress={onSave} loading={submitting || uploadingAvatar} disabled={username.trim().length < 3} />
        </View>
      </ScreenContainer>
    </Modal>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const theme = useAppTheme();
  const content = (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>{value}</Text>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function TrophyCase({ trophies }: { trophies: Trophy[] }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>Trophy Case</Text>
        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{trophies.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {trophies.map((trophy) => (
            <View key={trophy.key} style={{ alignItems: 'center', gap: theme.spacing.xs, width: 84 }}>
              <IconBadge name={trophy.icon} color={theme.colors.moduleTasks} size="lg" shape="square" />
              <Text style={{ color: theme.colors.textSecondary, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
                {trophy.label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
