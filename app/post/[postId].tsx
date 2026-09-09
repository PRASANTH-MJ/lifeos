import { useLocalSearchParams } from 'expo-router';
import { deleteDoc, doc } from 'firebase/firestore';
import { View } from 'react-native';

import { CenteredWebColumn, EmptyState, LoadingState, PostCard, ScreenContainer, showAlert } from '@/components';
import { auth, firestore } from '@/firebase/config';
import { usePost } from '@/modules/social';
import { useAppTheme } from '@/theme';

/** The signed-in, interactive counterpart to a public share link — reached either by tapping a
 * shared `/post/:postId` URL while already signed in on web, or via the `lifeos://post/:postId`
 * scheme link from PublicPostPreview's "Open in Flowsy" button on a device that has the app. A
 * signed-out web visitor never renders this file at all: app/_layout.tsx intercepts that
 * pathname before the Stack (which this route belongs to) ever mounts, and shows
 * PublicPostPreview instead — see that file for the read-only version of this same post. */
export default function PostDetailScreen() {
  const theme = useAppTheme();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { post, loading } = usePost(postId);
  const myUid = auth.currentUser?.uid;

  const confirmDelete = () => {
    if (!post) return;
    showAlert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(firestore, 'posts', post.id)) },
    ]);
  };

  return (
    <ScreenContainer>
      <CenteredWebColumn>
        {loading ? (
          <LoadingState />
        ) : !post ? (
          <View style={{ paddingTop: theme.spacing['4xl'] }}>
            <EmptyState icon="alert-circle-outline" title="Post not found" subtitle="It may have been deleted, or you don't have access to it." />
          </View>
        ) : (
          <View style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
            <PostCard post={post} onDelete={post.authorUid === myUid ? confirmDelete : undefined} />
          </View>
        )}
      </CenteredWebColumn>
    </ScreenContainer>
  );
}
