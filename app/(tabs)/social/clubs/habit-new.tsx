import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, EmptyState, ScreenContainer, TextField } from '@/components';
import { useClub, useCreateClubHabit, type ClubRecurrence } from '@/modules/clubs';
import { WEEKDAY_LABELS } from '@/modules/habits';
import { useAppTheme } from '@/theme';

/** Mirrors CreateChallengeScreen's plain-form shape. Recurrence is 'daily' or 'weekly' only — a
 * deliberately smaller set than the personal habit module's four frequencies (see
 * modules/clubs/clubProductivityTypes.ts's doc comment). */
export default function CreateClubHabitScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const { createClubHabit, submitting } = useCreateClubHabit();
  const { canModerate, loading: clubLoading } = useClub(clubId);

  const [title, setTitle] = useState('');
  const [recurrence, setRecurrence] = useState<ClubRecurrence>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);

  const canCreate = title.trim().length > 0 && (recurrence !== 'weekly' || targetDays.length > 0);

  const toggleDay = (day: number) => {
    setTargetDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));
  };

  const onCreate = async () => {
    if (!clubId || !canCreate) return;
    setError(null);
    try {
      await createClubHabit(clubId, {
        title: title.trim(),
        recurrence,
        targetDays: recurrence === 'weekly' ? targetDays : undefined,
      });
      router.replace({ pathname: '/social/clubs/habits', params: { clubId } });
    } catch {
      setError('Could not create the habit. Please try again.');
    }
  };

  // Only a club admin/sub-admin may create a club habit (see functions/index.js's createClubHabit
  // check) — this guards direct navigation here (e.g. a stale link) since the list screen already
  // hides the entry point for anyone else.
  if (!clubLoading && !canModerate) {
    return (
      <ScreenContainer>
        <EmptyState icon="lock-closed-outline" title="Admins only" subtitle="Only a club admin or sub-admin can create a club habit." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
          New Club Habit
        </Text>

        <TextField label="Title" placeholder="e.g. Morning run" value={title} onChangeText={setTitle} autoFocus />

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            Recurrence
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Chip label="Every day" selected={recurrence === 'daily'} onPress={() => setRecurrence('daily')} />
            <Chip label="Specific days" selected={recurrence === 'weekly'} onPress={() => setRecurrence('weekly')} />
          </View>
        </View>

        {recurrence === 'weekly' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Which days
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {WEEKDAY_LABELS.map((label, day) => (
                <Chip key={day} label={label} selected={targetDays.includes(day)} onPress={() => toggleDay(day)} />
              ))}
            </View>
          </View>
        ) : null}

        <Button label="Create Club Habit" onPress={onCreate} disabled={!canCreate} loading={submitting} glow />
        {error ? <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.xs, textAlign: 'center' }}>{error}</Text> : null}
      </View>
    </ScreenContainer>
  );
}
