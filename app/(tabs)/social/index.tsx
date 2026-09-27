import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  CenteredWebColumn,
  EmptyState,
  FAB_BOTTOM_OFFSET,
  FLOATING_TAB_BAR_CLEARANCE,
  FollowButton,
  LoadingState,
  PostCard,
  type PostLike,
  ScreenContainer,
  TextField,
  useIsDesktopWeb,
  showAlert,
} from '@/components';
import { auth } from '@/firebase/config';
import { useProfile } from '@/modules/profile';
import { uploadAvatar } from '@/modules/profile/avatarSync';
import { useFeed, useNotifications, usePublicProfile, useSuggestedUsers, useUsernameSetup, type FeedItem, type PublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

/** Feed hub — doubles as the one-time username-claim gate (a fresh account has no
 * userPublicProfiles doc yet), since every other social screen assumes one already exists.
 * Asks for a Name (shown on the profile header, in follower lists, family-plan member rows, split
 * expenses — anywhere `displayName` renders) and a Username (the unique "@handle" used for
 * search/mentions) — two different things that used to collapse into one: this form previously
 * set `displayName` to a copy of the username itself, so a shared/split expense or a profile page
 * showed someone's raw handle instead of their actual name. The Name field is prefilled from the
 * name already entered during onboarding (`useProfile()`'s local `profile.name`) so a user is
 * never asked to type their own name twice — a one-time seed, not a live sync, so editing it here
 * doesn't retroactively change the onboarding-stored name or vice versa. */
export default function SocialFeedScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const isDesktopWeb = useIsDesktopWeb();
  const myUid = auth.currentUser?.uid;
  const { profile, loading: profileLoading } = usePublicProfile(myUid);
  const { items, loading: feedLoading, refreshing, refresh, loadMore, removePost } = useFeed();
  const { suggestions: allSuggestions, loading: suggestionsLoading } = useSuggestedUsers();
  // Dismissing a suggestion is a purely local "not interested, stop showing me this" — no need to
  // persist it server-side or across sessions, so plain component state is enough.
  const [dismissedUids, setDismissedUids] = useState<Set<string>>(new Set());
  const suggestions = allSuggestions.filter((s) => !dismissedUids.has(s.uid));
  const dismissSuggestion = (uid: string) => setDismissedUids((current) => new Set(current).add(uid));
  // Mobile/tablet no longer interleaves "suggested for you" blocks into the post list — desktop
  // still keeps its own persistent right-hand sidebar (FeedSidebar below), a separate always-visible
  // column rather than something that scrolls past.
  // Only ever show the full-screen spinner for the very first load. Both useFeed and
  // useSuggestedUsers briefly flip their own `loading` back to true whenever their underlying
  // Firestore listener resubscribes (e.g. suggestions recomputing after a follow changes who's
  // excluded) — without this latch, that momentary flag would blank out an already-loaded feed
  // back to a spinner, discarding posts that were already on screen for no reason. Once loaded,
  // stay showing whatever's already there (even if briefly stale) instead of flickering to blank.
  const hasLoadedOnce = useRef(false);
  if (!feedLoading && !suggestionsLoading) hasLoadedOnce.current = true;
  const showInitialSpinner = !hasLoadedOnce.current && ((feedLoading && items.length === 0) || suggestionsLoading);
  const { claimUsername, submitting } = useUsernameSetup();
  const { profile: localProfile } = useProfile();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeds once from the onboarding-entered name as soon as it loads — guarded by
  // displayNameTouched (not just "is it empty") so a user who deliberately clears the field to
  // leave it blank doesn't have it silently repopulated the moment localProfile finishes loading.
  useEffect(() => {
    if (!displayNameTouched && localProfile?.name) setDisplayName(localProfile.name);
  }, [localProfile?.name, displayNameTouched]);

  const confirmDelete = useCallback(
    (postId: string) => {
      showAlert('Delete post?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removePost(postId) },
      ]);
    },
    [removePost]
  );

  // Both caches below exist so PostCard (wrapped in React.memo) actually gets to bail out of
  // re-rendering for posts whose own data hasn't changed. useFeed already preserves a FeedItem's
  // object identity across unrelated updates (see its own doc comment), but this renderItem used
  // to throw that away by building a brand-new `{ id: ..., ... }` object literal — and a brand-new
  // inline `() => confirmDelete(...)` closure — on every single call, for every row, on every
  // parent re-render. A memoized PostCard can't skip a re-render if its props are new objects each
  // time even when the content is identical. Keyed by FeedItem object reference (WeakMap) / postId
  // (Map) respectively so a genuinely new/changed post still gets a fresh entry.
  const postLikeCacheRef = useRef(new WeakMap<FeedItem, PostLike>());
  const toPostLike = (item: FeedItem): PostLike => {
    let cached = postLikeCacheRef.current.get(item);
    if (!cached) {
      cached = {
        id: item.postId,
        authorUid: item.authorUid,
        authorUsernameLower: item.authorUsernameLower,
        authorAvatarUrl: item.authorAvatarUrl,
        type: item.type,
        card: item.card,
        photoUrl: item.photoUrl,
        photoUrls: item.photoUrls,
        caption: item.caption,
        workoutTemplate: item.workoutTemplate,
      };
      postLikeCacheRef.current.set(item, cached);
    }
    return cached;
  };
  const deleteHandlersRef = useRef(new Map<string, () => void>());
  const getDeleteHandler = (postId: string): (() => void) => {
    let handler = deleteHandlersRef.current.get(postId);
    if (!handler) {
      handler = () => confirmDelete(postId);
      deleteHandlersRef.current.set(postId, handler);
    }
    return handler;
  };

  const onPickAvatar = async () => {
    // No permission request needed — see settings/index.tsx's onPickAvatar for why.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const onSetup = async () => {
    setError(null);
    let avatarUrl: string | null = null;
    if (avatarUri && myUid) {
      setUploadingAvatar(true);
      try {
        avatarUrl = await uploadAvatar(myUid, avatarUri);
      } catch {
        setUploadingAvatar(false);
        setError('Could not upload photo. Please try again.');
        return;
      }
      setUploadingAvatar(false);
    }
    const result = await claimUsername({ username: username.trim(), displayName: displayName.trim() || username.trim(), avatarUrl });
    if (!result.ok) setError(result.message);
  };

  if (profileLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <CenteredWebColumn maxWidth={440}>
        <ScreenContainer edges={['top', 'bottom']}>
          <View style={{ gap: theme.spacing.xl }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              Set up your social profile
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
              Pick a username so people can find and follow you. Letters, numbers, and underscores only.
            </Text>
            <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
              <Pressable onPress={onPickAvatar} accessibilityLabel="Add a profile photo">
                <Avatar url={avatarUri} size="lg" color={theme.colors.primary} />
              </Pressable>
              <Pressable onPress={onPickAvatar}>
                <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  {avatarUri ? 'Change photo' : 'Add a photo (optional)'}
                </Text>
              </Pressable>
            </View>
            <TextField
              label="Name"
              placeholder="Your name"
              value={displayName}
              onChangeText={(value) => {
                setDisplayNameTouched(true);
                setDisplayName(value);
              }}
            />
            <TextField label="Username" placeholder="e.g. alex_92" value={username} onChangeText={setUsername} autoCapitalize="none" />
            {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text> : null}
            <Button label="Get started" onPress={onSetup} disabled={username.trim().length < 3} loading={submitting || uploadingAvatar} />
          </View>
        </ScreenContainer>
      </CenteredWebColumn>
    );
  }

  // Desktop gets a real two-column layout (main feed + a right-hand widgets sidebar) instead of
  // a single stretched-mobile column with empty space on both sides — mirroring how Twitter/X and
  // LinkedIn use a wide desktop viewport, and its "who to follow" list lives permanently in that
  // sidebar. Mobile/tablet have no "who to follow" surface on this screen at all (see the removed
  // SuggestedUsersRow note above).
  return (
    <View style={{ flex: 1, flexDirection: isDesktopWeb ? 'row' : 'column', justifyContent: isDesktopWeb ? 'center' : undefined }}>
      <View style={isDesktopWeb ? { width: 600, maxWidth: 600 } : { flex: 1, width: '100%' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
            }}>
            <View>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
                Feed
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>@{profile.usernameLower}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}>
              <Pressable onPress={() => router.push('/social/clubs')} accessibilityLabel="Clubs" hitSlop={8}>
                <Ionicons name="people-circle-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => router.push('/social/search')} accessibilityLabel="Find people" hitSlop={8}>
                <Ionicons name="search" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => router.push('/social/saved')} accessibilityLabel="Saved posts" hitSlop={8}>
                <Ionicons name="bookmark-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <NotificationBell />
              <Pressable
                onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: myUid ?? '' } })}
                accessibilityLabel="My profile"
                hitSlop={8}>
                <Avatar url={profile.avatarUrl} size="sm" color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {showInitialSpinner ? (
            <LoadingState />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(post) => post.postId}
              contentContainerStyle={{ gap: theme.spacing.sm, alignItems: 'center', paddingBottom: theme.spacing.lg + FLOATING_TAB_BAR_CLEARANCE }}
              // Android defaults FlatList's removeClippedSubviews to true — a real, long-documented
              // RN/Android bug where rows scrolled just off-screen can come back permanently blank
              // (never re-rendered), which this list hit even after removing the interleaved
              // suggestions strip that originally seemed like the cause (confirmed via live
              // Firestore inspection that the posts themselves are well-formed, so this was never a
              // data problem) — disabling this optimization trades a little scroll-perf for rows
              // that reliably stay visible.
              removeClippedSubviews={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.6}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title="Your feed is empty"
                  subtitle="Follow someone to see their progress here."
                  ctaLabel="Find people to follow"
                  onPressCta={() => router.push('/social/search')}
                />
              }
              renderItem={({ item: post }) => (
                <PostCard post={toPostLike(post)} onDelete={post.authorUid === myUid ? getDeleteHandler(post.postId) : undefined} />
              )}
            />
          )}
        </SafeAreaView>

        <Pressable
          onPress={() => router.push('/social/compose')}
          accessibilityLabel="Share progress"
          style={{
            position: 'absolute',
            right: theme.spacing.xl,
            bottom: FAB_BOTTOM_OFFSET,
            width: 56,
            height: 56,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      {isDesktopWeb ? (
        <View style={{ width: 340, paddingTop: theme.spacing.xl + theme.spacing.md, paddingLeft: theme.spacing.xl, paddingRight: theme.spacing.lg }}>
          <FeedSidebar profile={profile} suggestions={suggestions} onDismiss={dismissSuggestion} />
        </View>
      ) : null}
    </View>
  );
}

function NotificationBell() {
  const theme = useAppTheme();
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <Pressable onPress={() => router.push('/social/notifications')} accessibilityLabel="Notifications" hitSlop={8} style={{ position: 'relative' }}>
      <Ionicons name="notifications-outline" size={22} color={theme.colors.textSecondary} />
      {unreadCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            paddingHorizontal: 2,
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: theme.typography.weight.bold }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Desktop's right-hand widget column (Twitter/LinkedIn-style) — fills the space that would
 * otherwise sit empty next to a single centered feed column. A quick-glance stats card plus a
 * vertical "who to follow" list, both linking into the same screens their mobile equivalents do. */
function FeedSidebar({
  profile,
  suggestions,
  onDismiss,
}: {
  profile: PublicProfile;
  suggestions: PublicProfile[];
  onDismiss: (uid: string) => void;
}) {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Pressable
        onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: profile.uid } })}
        style={{
          flexDirection: 'row',
          gap: theme.spacing.lg,
          padding: theme.spacing.lg,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceElevated,
        }}>
        <SidebarStat label="Posts" value={profile.postCount} />
        <SidebarStat label="Followers" value={profile.followerCount} />
        <SidebarStat label="Following" value={profile.followingCount} />
      </Pressable>

      {suggestions.length > 0 ? (
        <View style={{ borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceElevated, overflow: 'hidden' }}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.size.base,
              fontWeight: theme.typography.weight.bold,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
            }}>
            Suggested for you
          </Text>
          <View style={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
            {suggestions.slice(0, 5).map((item) => (
              <View key={item.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Pressable
                  onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: item.uid } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}>
                  <Avatar url={item.avatarUrl} size="sm" color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }} numberOfLines={1}>
                    @{item.usernameLower}
                  </Text>
                </Pressable>
                <FollowButton targetUid={item.uid} />
                <Pressable onPress={() => onDismiss(item.uid)} hitSlop={8} accessibilityLabel="Dismiss suggestion">
                  <Ionicons name="close" size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SidebarStat({ label, value }: { label: string; value: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>{value}</Text>
      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{label}</Text>
    </View>
  );
}

// The interleaved "suggested for you" strip that used to appear here (SuggestedUsersRow /
// SuggestedUserCard) was removed — it kept coinciding with reports of posts going blank further
// down the feed, and desktop's persistent FeedSidebar "who to follow" list already covers the same
// need there. `useSuggestedUsers`/`allSuggestions`/`dismissedUids` above are kept only for that
// desktop sidebar.
