import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Card, LoadingState, ScreenContainer, TextField } from '@/components';
import { useClub, useDeleteClub } from '@/modules/clubs';
import { useAppTheme } from '@/theme';

/** Full-admin-only "type the club name to confirm" screen — the single most destructive club
 * action (permanently deletes the club and everything in it for every member), so it gets the
 * same typed-confirmation treatment as app/delete-account.tsx rather than a plain
 * OK/Cancel alert. Reached only from [clubId].tsx's overflow menu, which already hides the entry
 * point from anyone but a full admin — this screen re-checks isAdmin itself too, since a route can
 * always be deep-linked directly. */
export default function DeleteClubScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { club, loading, isAdmin } = useClub(clubId);
  const { deleteClub, submitting } = useDeleteClub();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!club && confirmText.trim().toLowerCase() === club.name.trim().toLowerCase() && !submitting;

  const onDelete = async () => {
    if (!clubId) return;
    setError(null);
    try {
      await deleteClub(clubId);
      router.dismissTo('/social/clubs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
          Only a club admin can delete this club.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            Delete “{club.name}”
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>
            This permanently deletes the club and everything in it for all {club.memberCount} member{club.memberCount === 1 ? '' : 's'} —
            its chat, challenges, events, habits, and tasks. This cannot be undone.
          </Text>
        </View>

        <Card style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
            Type <Text style={{ fontWeight: theme.typography.weight.bold, color: theme.colors.danger }}>{club.name}</Text> to confirm.
          </Text>
          <TextField value={confirmText} onChangeText={setConfirmText} placeholder={club.name} autoCapitalize="none" autoCorrect={false} />
          {error ? (
            <View style={{ backgroundColor: theme.colors.dangerMuted, borderRadius: theme.radius.md, padding: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>{error}</Text>
            </View>
          ) : null}
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <Button label="Permanently delete this club" variant="danger" disabled={!canSubmit} onPress={onDelete} />
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
