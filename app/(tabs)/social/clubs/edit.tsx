import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Button, Chip, IconBadge, LoadingState, ScreenContainer, TextField } from '@/components';
import {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  CLUB_MAX_CATEGORIES,
  CLUB_PRIVACY_LABELS,
  useClub,
  useEditClub,
  type ClubCategory,
  type ClubPrivacy,
} from '@/modules/clubs';
import { useAppTheme } from '@/theme';

const CLUB_PRIVACY_LEVELS: ClubPrivacy[] = ['public', 'inviteOnly', 'private'];

/** Name/categories/privacy/photo editing for a club's FULL admins (not sub-admins) — a direct
 * client Firestore update for name/categories/privacy (see firestore.rules' clubs/{clubId} update
 * rule), plus the same expo-image-picker + Storage upload pattern as profile avatars (see
 * modules/profile/avatarSync.ts / modules/clubs/clubPhotoSync.ts). */
export default function EditClubScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { club, loading, isAdmin } = useClub(clubId);
  const { updateClub, updatePhoto, submitting } = useEditClub();

  const [name, setName] = useState('');
  const [categories, setCategories] = useState<Set<ClubCategory>>(() => new Set(['general']));
  const [privacy, setPrivacy] = useState<ClubPrivacy>('public');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!club) return;
    setName(club.name);
    setCategories(new Set(club.categories));
    setPrivacy(club.privacy);
    setPhotoUrl(club.photoUrl);
  }, [club]);

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

  const onPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setPhotoUrl(result.assets[0].uri);
      setPendingLocalUri(result.assets[0].uri);
    }
  };

  const onSave = async () => {
    if (!clubId || !name.trim()) return;
    setError(null);
    try {
      if (pendingLocalUri) {
        await updatePhoto(clubId, pendingLocalUri);
      }
      await updateClub(clubId, { name: name.trim(), categories: Array.from(categories), privacy });
      router.back();
    } catch {
      setError('Could not save changes. Please try again.');
    }
  };

  if (loading || !club) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Only a club admin can edit this club.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Pressable onPress={onPickPhoto} style={{ alignSelf: 'center' }}>
          {photoUrl ? <Avatar url={photoUrl} size="lg" /> : <IconBadge name="camera" color={theme.colors.moduleTasks} />}
        </Pressable>

        <TextField label="Club name" placeholder="e.g. Morning Runners" value={name} onChangeText={setName} />

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

        <Button label="Save" onPress={onSave} loading={submitting} disabled={!name.trim()} glow />
        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    </ScreenContainer>
  );
}
