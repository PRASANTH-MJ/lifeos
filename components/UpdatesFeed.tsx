import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';

import { useUpdates } from '@/modules/clubs';
import { formatDisplayDateTime } from '@/lib/date';
import { usePublicProfile } from '@/modules/social';
import { useAppTheme } from '@/theme';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { showAlert } from './showAlert';
import { TextField } from './TextField';

function UpdateRow({ authorUid, text, photoUrl, createdAtMs }: { authorUid: string; text: string | null; photoUrl: string | null; createdAtMs: number }) {
  const theme = useAppTheme();
  const { profile } = usePublicProfile(authorUid);

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Avatar url={profile?.avatarUrl ?? null} size="sm" color={theme.colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {profile ? `@${profile.usernameLower}` : '...'}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDateTime(new Date(createdAtMs).toISOString())}</Text>
        </View>
      </View>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 200, borderRadius: theme.radius.lg }} resizeMode="cover" /> : null}
      {text ? <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{text}</Text> : null}
    </Card>
  );
}

/** A lightweight append-only "post a photo/text update" feed scoped to one Challenge or Event —
 * lets participants share progress (a mid-challenge run photo, "made it to the group run!") right
 * where the rest of the group can see it, distinct from the main Feed (this update is scoped to
 * the challenge/event, not broadcast to your followers). `parentPath` is
 * `clubs/{clubId}/challenges/{challengeId}` or `clubs/{clubId}/events/{eventId}`. */
export function UpdatesFeed({ parentPath, canPost }: { parentPath: string; canPost: boolean }) {
  const theme = useAppTheme();
  const { updates, loading, posting, postUpdate } = useUpdates(parentPath);
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const onTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const onPickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const onPost = async () => {
    if (!text.trim() && !photoUri) return;
    try {
      await postUpdate({ text: text.trim() || null, localPhotoUri: photoUri });
      setText('');
      setPhotoUri(null);
      setComposerOpen(false);
    } catch {
      // postUpdate throws on failure (permission denied, offline, photo upload error, etc.) —
      // without this the rejection was unhandled and the composer just silently sat there with no
      // indication the post never went through.
      showAlert('Could not post update', 'Please try again.');
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Updates</Text>

      {canPost ? (
        composerOpen ? (
          <Card style={{ gap: theme.spacing.sm }}>
            {photoUri ? (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: photoUri }} style={{ width: '100%', height: 180, borderRadius: theme.radius.lg }} resizeMode="cover" />
                <Pressable
                  onPress={() => setPhotoUri(null)}
                  hitSlop={8}
                  style={{ position: 'absolute', top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.overlay, borderRadius: theme.radius.full, padding: 4 }}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              {Platform.OS !== 'web' ? (
                <View style={{ flex: 1 }}>
                  <Button label="Take photo" variant="secondary" onPress={onTakePhoto} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button label={photoUri ? 'Change photo' : 'Add photo'} variant="secondary" onPress={onPickFromLibrary} />
              </View>
            </View>
            <TextField placeholder="Share how it's going..." value={text} onChangeText={setText} multiline />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setComposerOpen(false)} disabled={posting} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Post" onPress={onPost} loading={posting} disabled={!text.trim() && !photoUri} />
              </View>
            </View>
          </Card>
        ) : (
          <Button label="Post an update" variant="secondary" onPress={() => setComposerOpen(true)} />
        )
      ) : null}

      {loading ? (
        <LoadingState />
      ) : updates.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No updates yet" subtitle={canPost ? 'Be the first to share your progress.' : 'Nothing posted here yet.'} />
      ) : (
        updates.map((update) => <UpdateRow key={update.id} {...update} />)
      )}
    </View>
  );
}
