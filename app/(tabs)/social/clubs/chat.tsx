import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Avatar, Button, EmptyState, LoadingState, ScreenContainer, TextField, showAlert } from '@/components';
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/tabBarMetrics';
import { auth } from '@/firebase/config';
import { formatDisplayDateTime } from '@/lib/date';
import { useClub, useClubMessages, type ClubMessage } from '@/modules/clubs';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';

function MessageRow({ authorUid, text, createdAtMs }: ClubMessage) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(authorUid);
  const isMe = authorUid === auth.currentUser?.uid;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      <Avatar url={profile?.avatarUrl ?? null} size="sm" color={theme.colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {isMe ? 'You' : profile ? `@${profile.usernameLower}` : '...'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDateTime(new Date(createdAtMs).toISOString())}</Text>
        </View>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{text}</Text>
      </View>
    </View>
  );
}

/** Club chat — plain real-time text messages, direct client writes like the `updates`
 * subcollections (see modules/clubs/useUpdates.ts), but ordered oldest-first with
 * auto-scroll-to-bottom since a chat reads like a conversation, not a feed. Rendered as its own
 * screen (scroll={false} so the FlatList owns scrolling) rather than a section on the club detail
 * screen, since a chat wants the full viewport. */
export default function ClubChatScreen() {
  const theme = useAppTheme();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { isMember } = useClub(clubId);
  const { messages, loading, sending, sendMessage } = useClubMessages(clubId);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ClubMessage>>(null);

  const onSend = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      await sendMessage(value);
    } catch {
      // sendMessage throws on failure (permission denied, offline, etc.) — restore the typed
      // text instead of silently losing it, and actually tell the user it didn't go through.
      setText(value);
      showAlert('Message not sent', 'Please check your connection and try again.');
    }
  };

  return (
    <ScreenContainer scroll={false} bottomClearance={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <LoadingState />
        ) : messages.length === 0 ? (
          <EmptyState icon="chatbubbles-outline" title="No messages yet" subtitle="Say hello to the club." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageRow {...item} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingVertical: theme.spacing.md }}
          />
        )}
        {isMember ? (
          // This composer is docked below the FlatList inside ScreenContainer's own
          // bottomClearance={false} area, so it must reserve its own clearance from the floating
          // tab bar + AI FAB — otherwise both sit on top of the Send button (this route doesn't
          // hide the tab bar, so it's the plain, non-_HIDDEN clearance amount).
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', paddingTop: theme.spacing.sm, paddingBottom: FLOATING_TAB_BAR_CLEARANCE }}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Message the club..." value={text} onChangeText={setText} onSubmitEditing={onSend} />
            </View>
            <Button label="Send" onPress={onSend} loading={sending} disabled={!text.trim()} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
