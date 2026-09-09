import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Button, Chip, EmptyState, IconBadge, ScreenContainer, TextField } from '@/components';
import {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  CLUB_MAX_CATEGORIES,
  CLUB_PRIVACY_LABELS,
  uploadClubPhoto,
  useCreateClub,
  type ClubCategory,
  type ClubPrivacy,
} from '@/modules/clubs';
import { usePremium } from '@/modules/premium';
import { useAppTheme } from '@/theme';

const CLUB_PRIVACY_LEVELS: ClubPrivacy[] = ['public', 'inviteOnly', 'private'];

export default function CreateClubScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { premium } = usePremium();
  const { createClub, submitting } = useCreateClub();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Set<ClubCategory>>(() => new Set(['general']));
  const [privacy, setPrivacy] = useState<ClubPrivacy>('public');
  // Locally-picked photo URI, uploaded (via the same uploadClubPhoto used by the Edit Club screen)
  // right after the club doc itself is created — createClub's callable has no notion of Storage
  // uploads, so the club is created first (photoUrl: null) and this fills it in as a second step.
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) setPendingLocalUri(result.assets[0].uri);
  };

  // Same toggle-a-Set pattern as the exercise library's multi-select filters (see
  // app/(tabs)/workout/exercises/index.tsx's toggleInFilterSet), just capped at
  // CLUB_MAX_CATEGORIES and never allowed to drop below one selected tag.
  const toggleCategory = (value: ClubCategory) => {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        if (next.size > 1) next.delete(value);
      } else if (next.size < CLUB_MAX_CATEGORIES) {
        next.add(value);
      }
      return next;
    });
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const clubId = await createClub(name.trim(), description.trim(), Array.from(categories), privacy);
      if (pendingLocalUri) {
        // Best-effort: a failed photo upload shouldn't block navigating into the just-created
        // club — the creator can still set a photo later from the Edit Club screen.
        await uploadClubPhoto(clubId, pendingLocalUri).catch(() => {});
      }
      router.replace({ pathname: '/social/clubs/[clubId]', params: { clubId } });
    } catch {
      // createClub's httpsCallable throws on failure (network error, backend validation, etc.) —
      // without this the promise rejection was unhandled and the button just silently reset with
      // no feedback at all.
      setError('Could not create the club. Please try again.');
    }
  };

  if (!premium) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="people-outline"
          title="Creating a club is a Pro feature"
          subtitle="Go Pro to start your own club and invite people to share habits, tasks, events, and challenges together."
          ctaLabel="Go Pro"
          onPressCta={() => router.push('/premium')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Pressable onPress={onPickPhoto} style={{ alignSelf: 'center' }}>
          {pendingLocalUri ? <Avatar url={pendingLocalUri} size="lg" /> : <IconBadge name="camera" color={theme.colors.moduleTasks} />}
        </Pressable>

        <TextField label="Club name" placeholder="e.g. Morning Runners" value={name} onChangeText={setName} autoFocus />
        <TextField label="Description (optional)" placeholder="What's this club about?" value={description} onChangeText={setDescription} multiline />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Categories (up to {CLUB_MAX_CATEGORIES})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CLUB_CATEGORIES.map((option) => (
              <Chip key={option} label={CLUB_CATEGORY_LABELS[option]} selected={categories.has(option)} onPress={() => toggleCategory(option)} />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Privacy
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {CLUB_PRIVACY_LEVELS.map((option) => (
              <Chip key={option} label={CLUB_PRIVACY_LABELS[option]} selected={privacy === option} onPress={() => setPrivacy(option)} />
            ))}
          </View>
        </View>

        <Button label="Create" onPress={onCreate} loading={submitting} disabled={!name.trim()} glow />
        {error ? (
          <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text>
        ) : !name.trim() ? (
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            Enter a club name to continue
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
