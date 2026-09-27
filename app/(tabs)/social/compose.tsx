import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { Button, Card, CenteredWebColumn, Chip, EmptyState, ScreenContainer, showAlert, TextField, type ShareCardData } from '@/components';
import { formatDisplayDate } from '@/lib/date';
import { CARDIO_ACTIVITY_LABELS, isDistanceActivity, useCardioLogs, type CardioLog } from '@/modules/cardio';
import { useHabits } from '@/modules/habits';
import { usePostComposer } from '@/modules/social';
import { useAppTheme } from '@/theme';

function cardForLog(log: CardioLog): ShareCardData {
  const distance = isDistanceActivity(log.activity);
  return {
    eyebrow: CARDIO_ACTIVITY_LABELS[log.activity].toUpperCase(),
    value: distance ? String(log.distanceKm ?? 0) : String(log.durationMinutes),
    valueLabel: distance ? 'KM' : 'MINUTES',
    detail: [log.sportName, `${log.durationMinutes} min`].filter(Boolean).join(' · '),
    icon: 'walk',
    accentColor: '#3D8BFF',
  };
}

function cardForStreak(name: string, streak: number): ShareCardData {
  return {
    eyebrow: name.toUpperCase(),
    value: String(streak),
    valueLabel: streak === 1 ? 'DAY STREAK' : 'DAY STREAK',
    icon: 'flame',
    accentColor: '#FF9500',
  };
}

type Mode = 'text' | 'activity' | 'streak';

export default function SocialComposeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { logs } = useCardioLogs();
  const { habits } = useHabits();
  const { createPost, posting } = usePostComposer();
  const [mode, setMode] = useState<Mode>('text');
  const [caption, setCaption] = useState('');
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);
  const streakHabits = useMemo(() => habits.filter((h) => h.streak > 0), [habits]);
  const selectedLog = recentLogs.find((log) => log.id === selectedLogId) ?? null;
  const selectedHabit = streakHabits.find((h) => h.habit.id === selectedHabitId) ?? null;

  const canPost =
    mode === 'text' ? caption.trim().length > 0 || localPhotoUri != null : mode === 'activity' ? selectedLog != null : selectedHabit != null;

  const onPickPhoto = async () => {
    // No permission request needed — see app/(tabs)/settings/index.tsx's onPickAvatar for why.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setLocalPhotoUri(result.assets[0].uri);
  };

  const onPost = async () => {
    try {
      if (mode === 'text') {
        await createPost({ type: 'text', caption, localPhotoUri });
      } else if (mode === 'activity' && selectedLog) {
        await createPost({ type: 'activity', card: cardForLog(selectedLog), caption: caption.trim() || null, localPhotoUri });
      } else if (mode === 'streak' && selectedHabit) {
        await createPost({
          type: 'milestone',
          card: cardForStreak(selectedHabit.habit.name, selectedHabit.streak),
          caption: caption.trim() || null,
          localPhotoUri,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        showAlert('Slow down', "You've posted a lot in a short time — please wait a few minutes and try again.");
        return;
      }
      throw err;
    }
    router.back();
  };

  return (
    <CenteredWebColumn maxWidth={520}>
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
          Share with your followers
        </Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Chip label="Text update" selected={mode === 'text'} onPress={() => setMode('text')} />
          <Chip label="Share an activity" selected={mode === 'activity'} onPress={() => setMode('activity')} />
          <Chip label="Share a streak" selected={mode === 'streak'} onPress={() => setMode('streak')} />
        </View>

        {mode === 'activity' ? (
          recentLogs.length === 0 ? (
            <EmptyState icon="walk-outline" title="No recent activity" subtitle="Log a run, walk, or workout in Activity Tracker first." />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {recentLogs.map((log) => (
                <Pressable key={log.id} onPress={() => setSelectedLogId(log.id)}>
                  <Card
                    tier={selectedLogId === log.id ? 'elevated' : 'panel'}
                    style={{ borderWidth: selectedLogId === log.id ? 2 : 0, borderColor: theme.colors.primary }}>
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.medium }}>
                      {CARDIO_ACTIVITY_LABELS[log.activity]}
                      {log.distanceKm != null ? ` · ${log.distanceKm} km` : ''} · {log.durationMinutes} min
                    </Text>
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(log.date)}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )
        ) : null}

        {mode === 'streak' ? (
          streakHabits.length === 0 ? (
            <EmptyState icon="flame-outline" title="No active streaks" subtitle="Keep a habit going for a couple of days to share it here." />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {streakHabits.map(({ habit, streak }) => (
                <Pressable key={habit.id} onPress={() => setSelectedHabitId(habit.id)}>
                  <Card
                    tier={selectedHabitId === habit.id ? 'elevated' : 'panel'}
                    style={{ borderWidth: selectedHabitId === habit.id ? 2 : 0, borderColor: theme.colors.primary }}>
                    <Text style={{ color: theme.colors.textPrimary, fontWeight: theme.typography.weight.medium }}>
                      {habit.name} · {streak} day{streak === 1 ? '' : 's'}
                    </Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )
        ) : null}

        {localPhotoUri ? (
          <View style={{ position: 'relative' }}>
            <Image source={{ uri: localPhotoUri }} style={{ width: '100%', height: 220, borderRadius: theme.radius.lg }} resizeMode="cover" />
            <Pressable
              onPress={() => setLocalPhotoUri(null)}
              hitSlop={8}
              style={{ position: 'absolute', top: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: theme.colors.overlay, borderRadius: theme.radius.full, padding: 4 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onPickPhoto}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderStyle: 'dashed',
            }}>
            <Ionicons name="image-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>Add a photo (optional)</Text>
          </Pressable>
        )}

        <TextField
          label={mode === 'text' ? "What's on your mind?" : 'Caption (optional)'}
          placeholder="Say something..."
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <Button label="Post" onPress={onPost} disabled={!canPost} loading={posting} />
      </View>
    </ScreenContainer>
    </CenteredWebColumn>
  );
}
