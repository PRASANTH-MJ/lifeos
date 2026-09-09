import { useRouter } from 'expo-router';
import { Image, Linking, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, LoadingState, ShareCard } from '@/components';
import { useAppTheme } from '@/theme';

import { usePost } from './usePost';

/** Renders at a public post's share-link URL (see postShareUrl.ts) for a visitor who's opened it
 * on the web WITHOUT being signed in — app/_layout.tsx routes here directly, before the sign-in
 * gate, for any `/post/:postId` pathname on web (mirroring how it already does this for
 * /terms, /privacy-policy, /refund-policy). A signed-in visitor (native, or signed-in web) never
 * reaches this component at all — they get app/post/[postId].tsx's normal, interactive
 * PostCard-based view instead, reached through the regular Stack.
 *
 * There's no native App Links/Universal Links setup (a larger, separate infra task), so "Open in
 * Flowsy" is just a plain `lifeos://` scheme link — it does nothing visible if the app isn't
 * installed, which is an accepted limitation, not a bug. */
export function PublicPostPreview({ postId }: { postId: string }) {
  const theme = useAppTheme();
  const router = useRouter();
  const { post, loading } = usePost(postId);

  if (loading) return <LoadingState />;

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <EmptyState icon="alert-circle-outline" title="Post not found" subtitle="It may have been deleted, or made private." />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: theme.spacing['4xl'], gap: theme.spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      style={{ backgroundColor: theme.colors.background }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>Flowsy</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Shared from the app</Text>
      </View>

      <Card tier="panel" style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Avatar url={post.authorAvatarUrl} size="sm" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.semibold }}>@{post.authorUsernameLower}</Text>
        </View>

        {/* This unauthenticated landing page keeps things simple with just the first carousel
         * photo (route map/first card) rather than a full swipeable gallery — a signed-in visitor
         * gets the real PostCard carousel instead (see app/_layout.tsx's routing). */}
        {post.photoUrl ? (
          <Image source={{ uri: post.photoUrl }} style={{ width: '100%', height: 320, borderRadius: theme.radius.lg }} resizeMode="cover" />
        ) : null}

        {post.card && !post.photoUrl ? (
          <View style={{ alignItems: 'center' }}>
            <ShareCard data={post.card} />
          </View>
        ) : null}

        {post.caption ? <Text style={{ color: theme.colors.textSecondary }}>{post.caption}</Text> : null}
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Open in Flowsy" variant="gradient" onPress={() => Linking.openURL(`lifeos://post/${postId}`)} />
        <Button label="Get the app" variant="secondary" onPress={() => router.push('/')} />
      </View>
    </ScrollView>
  );
}
