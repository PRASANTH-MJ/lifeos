import { FlatList, Text, View } from 'react-native';

import { CenteredWebColumn, EmptyState, FLOATING_TAB_BAR_CLEARANCE, LoadingState, PostCard, ScreenContainer } from '@/components';
import { auth } from '@/firebase/config';
import { useSavedPosts } from '@/modules/social';
import { useAppTheme } from '@/theme';

/** The viewer's own bookmarked posts (`users/{uid}/savedPosts`, see useSavedPosts.ts) — reuses
 * PostCard as-is, same as the feed and a profile's own post list, so liking/commenting/sharing
 * and the bookmark toggle itself all behave identically here. No onDelete is wired up (unlike the
 * feed/profile lists) — deleting a post is that post's own screen's job, not this bookmark list's;
 * unsaving it (the bookmark toggle on the card itself) is how a post leaves THIS list. */
export default function SavedPostsScreen() {
  const theme = useAppTheme();
  const myUid = auth.currentUser?.uid;
  const { posts, loading } = useSavedPosts(myUid);

  return (
    <CenteredWebColumn maxWidth={600}>
      <ScreenContainer edges={['top', 'bottom']} scroll={false}>
        <View style={{ gap: theme.spacing.xl, flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Saved posts
          </Text>

          {loading ? (
            <LoadingState />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: theme.spacing.sm, alignItems: 'center', paddingBottom: theme.spacing.lg + FLOATING_TAB_BAR_CLEARANCE }}
              ListEmptyComponent={<EmptyState icon="bookmark-outline" title="No saved posts yet" subtitle="Tap the bookmark icon on a post to save it here." />}
              renderItem={({ item }) => <PostCard post={item} />}
            />
          )}
        </View>
      </ScreenContainer>
    </CenteredWebColumn>
  );
}
