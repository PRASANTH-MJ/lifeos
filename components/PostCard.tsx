import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { auth } from '@/firebase/config';
import {
  buildPostShareUrl,
  sharePost,
  useComments,
  useLike,
  usePostEngagement,
  usePublicProfile,
  useReportContent,
  useSavePost,
  type Comment,
  type PostType,
  type ReactionType,
  type ReportReason,
  type WorkoutTemplatePayload,
} from '@/modules/social';
import { useCustomWorkouts, type Equipment, type WorkoutGoal } from '@/modules/workout';
import { useAppTheme } from '@/theme';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { useIsDesktopWeb } from './CenteredWebColumn';
import { showAlert } from './showAlert';
import { ShareCard, type ShareCardData } from './ShareCard';
import { ShareCardModal } from './ShareCardModal';
import { TextField } from './TextField';

/** Strava-kudos-style reaction row, revealed on long-press — a plain tap stays the fast-path
 * default (react('like')). Ionicons rather than emoji to match this app's icon-driven visual
 * language elsewhere (IconBadge, tab icons, etc.) instead of the emoji-heavy style some other
 * social apps use. */
const REACTIONS: { type: ReactionType; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { type: 'like', icon: 'heart', label: 'Like' },
  { type: 'fire', icon: 'flame', label: 'Fire' },
  { type: 'flex', icon: 'barbell', label: 'Flex' },
  { type: 'clap', icon: 'hand-left', label: 'Clap' },
];

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
];

// A post photo is no longer forced into a fixed-height cropped box (see PostPhoto below) — these
// are just an upper bound so an extreme outlier (a very tall/narrow shot) doesn't push the whole
// card several screens tall; anything under the cap renders at its own true aspect ratio.
const MAX_PHOTO_HEIGHT_MOBILE = 500;
const MAX_PHOTO_HEIGHT_DESKTOP = 600;

const DESKTOP_CARD_WIDTH = 520;
// On phone, a fixed width (the old value was a flat 320px) reads as a narrow column with dead
// margins on either side once the device is wider than that — use the actual screen width minus
// the standard side padding instead, capped so a tablet-width phone doesn't stretch the card
// absurdly wide.
const MAX_MOBILE_CARD_WIDTH = 480;

export type PostLike = {
  id: string;
  authorUid: string;
  authorUsernameLower: string;
  authorAvatarUrl: string | null;
  type: PostType;
  card: ShareCardData | null;
  photoUrl: string | null;
  photoUrls: string[] | null;
  caption: string | null;
  workoutTemplate: WorkoutTemplatePayload | null;
};

type Props = {
  post: PostLike;
  /** Shown only when the viewer owns this post — a delete affordance. */
  onDelete?: () => void;
};

/** Renders one post (photo and/or a ShareCard, plus caption) with Like/Comment/Share actions —
 * shared between the feed and a profile's own post list so those two screens don't duplicate this
 * logic. Live like/comment counts come from usePostEngagement (reads the post doc directly, not
 * a stale feed-copy field), and "Share" reuses the existing ShareCardModal for activity/streak
 * cards or falls through to modules/social/sharePost.ts for a plain photo/text post.
 *
 * The author's username/avatar come straight off `post` (denormalized at post-creation time —
 * see usePostComposer.ts), not a separate usePublicProfile(post.authorUid) listener. A feed
 * renders many posts (by many different authors) at once; each one opening its own profile
 * listener meant the author's name visibly popped in a beat after the rest of the card, on every
 * single post, every time. */
export const PostCard = memo(function PostCard({ post, onDelete }: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const isDesktopWeb = useIsDesktopWeb();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = isDesktopWeb ? DESKTOP_CARD_WIDTH : Math.min(windowWidth - theme.spacing.lg * 2, MAX_MOBILE_CARD_WIDTH);
  const { reaction, submitting, react } = useLike(post.id);
  const { likeCount, commentCount } = usePostEngagement(post.id);
  const [commentsVisible, setCommentsVisible] = useState(false);
  // Only subscribes once the comments modal has actually been opened at least once (and stays
  // subscribed after that) — see useComments' own doc comment for why this used to be an
  // always-on listener per rendered card regardless of whether anyone opened it.
  const { comments, addComment } = useComments(post.id, commentsVisible);
  const { saved, toggleSave } = useSavePost(post.id);
  const { report, submitting: reportSubmitting } = useReportContent();
  const [shareCardVisible, setShareCardVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportPickerVisible, setReportPickerVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const { addWorkout } = useCustomWorkouts();

  // The multi-card carousel (route map, stats card, streak card, a user's own photo — see
  // ActivityShareCarousel.tsx) when present, else the single legacy photo every older post has —
  // see modules/social/types.ts's Post.photoUrls doc for why both fields can coexist.
  const postPhotos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];

  const myUid = auth.currentUser?.uid;
  const isMe = post.authorUid === myUid;
  const activeReaction = REACTIONS.find((r) => r.type === reaction);
  const reactionColor: Record<ReactionType, string> = {
    like: theme.colors.danger,
    fire: theme.colors.warning,
    flex: theme.colors.primary,
    clap: theme.colors.success,
  };

  // Saves a fresh, empty copy into the importer's own custom_workouts via the same create-workout
  // path the builder screen uses — never touches the author's post or their own workout.
  const onImportWorkout = async () => {
    if (!post.workoutTemplate) return;
    setImporting(true);
    try {
      await addWorkout({
        title: post.workoutTemplate.title,
        goal: post.workoutTemplate.goal as WorkoutGoal,
        equipment: post.workoutTemplate.equipment as Equipment,
        minutes: post.workoutTemplate.minutes,
        exercises: post.workoutTemplate.exercises,
      });
      setImported(true);
    } finally {
      setImporting(false);
    }
  };

  const onSubmitReport = async (reason: ReportReason) => {
    setReportPickerVisible(false);
    await report('post', post.id, reason);
    showAlert('Report submitted', "Thanks — we'll take a look.");
  };

  const onShare = async () => {
    if (post.card) {
      // ShareCardModal has its own dedicated Share button (a screenshot of the generated
      // achievement/streak card) — kept as-is rather than also firing a second, competing share
      // sheet here for the public post link.
      setShareCardVisible(true);
      return;
    }
    await sharePost({ photoUrl: post.photoUrl, caption: post.caption, shareUrl: buildPostShareUrl(post.id) });
  };

  const onSendComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment(commentText, replyingTo?.id ?? null);
      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        showAlert('Slow down', "You've commented a lot in a short time — please wait a few minutes and try again.");
        return;
      }
      throw err;
    }
  };

  // Only one level of nesting (see modules/social/types.ts's Comment.replyToCommentId doc) — a
  // reply row never itself offers a "Reply" action, so `repliesByParentId` only ever needs to be
  // keyed off top-level comments.
  const topLevelComments = comments.filter((c) => !c.replyToCommentId);
  const repliesByParentId = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.replyToCommentId) (acc[c.replyToCommentId] ??= []).push(c);
    return acc;
  }, {});

  return (
    <Card tier="panel" style={{ gap: theme.spacing.sm, width: cardWidth }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => router.push({ pathname: '/social/profile/[uid]', params: { uid: post.authorUid } })}
          accessibilityLabel="View profile"
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Avatar url={post.authorAvatarUrl} size="sm" color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.semibold }}>@{post.authorUsernameLower}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          {onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
            </Pressable>
          ) : null}
          {!isMe ? (
            <Pressable onPress={() => setMenuVisible(true)} accessibilityLabel="More options" hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {postPhotos.length > 0 ? (
        <PostPhotoCarousel uris={postPhotos} cardWidth={cardWidth} maxHeight={isDesktopWeb ? MAX_PHOTO_HEIGHT_DESKTOP : MAX_PHOTO_HEIGHT_MOBILE} />
      ) : null}

      {/* A photo already has its stats baked in via PhotoStoryTemplate at post time — showing the
       * plain ShareCard underneath it as well would just duplicate the same numbers twice. */}
      {post.card && postPhotos.length === 0 ? (
        <View style={{ alignItems: 'center' }}>
          <ShareCard data={post.card} />
        </View>
      ) : null}

      {post.caption ? <Text style={{ color: theme.colors.textSecondary }}>{post.caption}</Text> : null}

      {post.type === 'workoutTemplate' && post.workoutTemplate ? (
        <Button
          label={imported ? 'Added to your workouts' : 'Import this workout'}
          variant="secondary"
          onPress={onImportWorkout}
          loading={importing}
          disabled={imported}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.xl, alignItems: 'center', marginTop: theme.spacing.xs }}>
        <View style={{ position: 'relative' }}>
          {reactionPickerVisible ? (
            <View
              style={{
                position: 'absolute',
                bottom: '100%',
                left: -theme.spacing.sm,
                marginBottom: theme.spacing.xs,
                flexDirection: 'row',
                gap: theme.spacing.md,
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.full,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                zIndex: 10,
                ...theme.shadow.sm,
              }}>
              {REACTIONS.map((r) => (
                <Pressable
                  key={r.type}
                  onPress={() => {
                    react(r.type);
                    setReactionPickerVisible(false);
                  }}
                  accessibilityLabel={r.label}
                  hitSlop={6}>
                  <Ionicons name={r.icon} size={22} color={reaction === r.type ? reactionColor[r.type] : theme.colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => (reactionPickerVisible ? setReactionPickerVisible(false) : react(reaction ?? 'like'))}
            onLongPress={() => setReactionPickerVisible(true)}
            disabled={submitting}
            accessibilityLabel={reaction ? `Remove ${activeReaction?.label ?? 'like'} reaction` : 'Like'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            hitSlop={8}>
            <Ionicons
              name={reaction ? activeReaction?.icon ?? 'heart' : 'heart-outline'}
              size={20}
              color={reaction ? reactionColor[reaction] : theme.colors.textSecondary}
            />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{likeCount}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setCommentsVisible(true)}
          accessibilityLabel="Comments"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={19} color={theme.colors.textSecondary} />
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{commentCount}</Text>
        </Pressable>
        <Pressable onPress={onShare} accessibilityLabel="Share" hitSlop={8}>
          <Ionicons name="share-outline" size={20} color={theme.colors.textSecondary} />
        </Pressable>
        <Pressable onPress={toggleSave} accessibilityLabel={saved ? 'Remove from saved posts' : 'Save post'} hitSlop={8} style={{ marginLeft: 'auto' }}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.colors.primary : theme.colors.textSecondary} />
        </Pressable>
      </View>

      {post.card ? <ShareCardModal visible={shareCardVisible} onClose={() => setShareCardVisible(false)} data={post.card} /> : null}

      <Modal visible={commentsVisible} animationType="slide" transparent onRequestClose={() => setCommentsVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={{ flex: 1 }} onPress={() => setCommentsVisible(false)} />
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
              maxHeight: '70%',
            }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.bold, fontSize: theme.typography.size.lg }}>Comments</Text>
            <ScrollView style={{ gap: theme.spacing.sm }}>
              {comments.length === 0 ? (
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>No comments yet.</Text>
              ) : (
                topLevelComments.map((comment) => (
                  <View key={comment.id}>
                    <CommentRow comment={comment} onReply={() => setReplyingTo(comment)} />
                    {(repliesByParentId[comment.id] ?? []).map((reply) => (
                      <View key={reply.id} style={{ marginLeft: theme.spacing.xl }}>
                        <CommentRow comment={reply} />
                      </View>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
            {replyingTo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ReplyingToLabel uid={replyingTo.authorUid} />
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={8} accessibilityLabel="Cancel reply">
                  <Ionicons name="close" size={16} color={theme.colors.textTertiary} />
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
                  value={commentText}
                  onChangeText={setCommentText}
                  onSubmitEditing={onSendComment}
                />
              </View>
              <Button label="Send" onPress={onSendComment} disabled={!commentText.trim()} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }} onPress={() => setMenuVisible(false)}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}>
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                setReportPickerVisible(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
              <Ionicons name="flag-outline" size={20} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                Report post
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={reportPickerVisible} transparent animationType="fade" onRequestClose={() => setReportPickerVisible(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }} onPress={() => setReportPickerVisible(false)}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.bold, fontSize: theme.typography.size.lg }}>
              Why are you reporting this post?
            </Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r.value} onPress={() => onSubmitReport(r.value)} disabled={reportSubmitting} style={{ paddingVertical: theme.spacing.md }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base }}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Card>
  );
});

/** A single photo renders exactly as before (PostPhoto, unchanged) — a real carousel (2+ pages,
 * from ActivityShareCarousel.tsx's route/stats/photo/streak cards) adds a swipeable
 * `pagingEnabled` ScrollView with dot indicators underneath, Strava-style. No new library: this
 * is the same lightweight "ScrollView + pagingEnabled + dots" approach used nowhere else yet in
 * this codebase, since nothing needed a swipeable multi-image gallery before this post shape. */
function PostPhotoCarousel({ uris, cardWidth, maxHeight }: { uris: string[]; cardWidth: number; maxHeight: number }) {
  const theme = useAppTheme();
  const [page, setPage] = useState(0);

  if (uris.length === 1) return <PostPhoto uri={uris[0]} maxHeight={maxHeight} />;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth));
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ width: cardWidth }}>
        {uris.map((uri, i) => (
          <View key={`${uri}-${i}`} style={{ width: cardWidth }}>
            <PostPhoto uri={uri} maxHeight={maxHeight} />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: theme.spacing.xs }}>
        {uris.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === page ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === page ? theme.colors.primary : theme.colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Renders a post's photo at its own natural aspect ratio instead of a fixed-height `cover` box
 * (which cropped every photo that wasn't exactly that box's ratio — see PhotoStoryTemplate, which
 * had the same bug on the capture side). `aspectRatio` + `maxHeight` on the Image itself, rather
 * than computing pixel dimensions by hand, lets the layout engine do the clamping: under the cap
 * it renders at the true ratio with nothing cropped, and only a genuinely extreme outlier (past
 * `maxHeight`) ever gets `resizeMode="contain"`'s letterboxing instead of a crop. */
function PostPhoto({ uri, maxHeight }: { uri: string; maxHeight: number }) {
  const theme = useAppTheme();
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled) setRatio(width / height);
      },
      () => {
        // Unreadable URI — keep the fallback ratio below rather than leaving `ratio` unset.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: ratio ?? 4 / 5, maxHeight, borderRadius: theme.radius.lg }}
      resizeMode="contain"
    />
  );
}

function CommentAuthor({ uid }: { uid: string }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(uid);
  return (
    <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.semibold, fontSize: theme.typography.size.sm }}>
      {profile ? `@${profile.usernameLower}` : '...'}
    </Text>
  );
}

/** One comment row — used both for a top-level comment and (indented by the caller, one level
 * only) for a reply. `onReply` is omitted for a reply row itself, since replying to a reply isn't
 * offered (see PostCard's repliesByParentId comment). */
function CommentRow({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs, alignItems: 'flex-start' }}>
      <CommentAuthor uid={comment.authorUid} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{comment.text}</Text>
        {onReply ? (
          <Pressable onPress={onReply} hitSlop={6}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
              Reply
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ReplyingToLabel({ uid }: { uid: string }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(uid);
  return (
    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
      Replying to {profile ? `@${profile.usernameLower}` : '...'}
    </Text>
  );
}
