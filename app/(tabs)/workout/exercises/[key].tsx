import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { Button, Card, EmptyState, LoadingState, ScreenContainer, TextField, TrendChart } from '@/components';
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/tabBarMetrics';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { findLibraryExercise, useCustomWorkouts, useExerciseLogs, useRecentExercises } from '@/modules/workout';
import { useAppTheme } from '@/theme';

type DetailTab = 'about' | 'history' | 'progress';

export default function ExerciseDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const exercise = findLibraryExercise(key);
  const { logs, loading, addLog, removeLog } = useExerciseLogs(key ?? '');
  const { recordView } = useRecentExercises();
  const { workouts: customWorkouts, addExerciseToWorkout } = useCustomWorkouts();

  useEffect(() => {
    if (key) recordView(key);
  }, [key, recordView]);

  const [tab, setTab] = useState<DetailTab>('about');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) {
      setRestSecondsLeft(null);
      return;
    }
    const timeout = setTimeout(() => setRestSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timeout);
  }, [restSecondsLeft]);

  if (!exercise) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Exercise not found" />
      </ScreenContainer>
    );
  }

  const onLogSet = async () => {
    setSaving(true);
    try {
      await addLog({
        date: todayKey(),
        sets: sets.trim() ? Math.round(Number(sets)) : null,
        reps: reps.trim() ? Math.round(Number(reps)) : null,
        weightKg: weight.trim() ? Number(weight) : null,
      });
      setSets('');
      setReps('');
      setWeight('');
      setRestSecondsLeft(60);
    } finally {
      setSaving(false);
    }
  };

  const onOpenYoutube = () => {
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} exercise how to`)}`);
  };

  const onShare = () => {
    Share.share({ message: `Check out this exercise on Flowsy: ${exercise.name}` });
  };

  const onStartTimer = () => setRestSecondsLeft(60);

  const onAddToWorkout = () => {
    const createNew = () => router.push({ pathname: '/workout/new', params: { prefill: exercise.name } });
    if (customWorkouts.length === 0) {
      createNew();
      return;
    }
    Alert.alert('Add to workout', `Add "${exercise.name}" to which workout?`, [
      ...customWorkouts.map((w) => ({
        text: w.title,
        onPress: async () => {
          await addExerciseToWorkout(w.key, exercise.name);
          Alert.alert('Added', `Added ${exercise.name} to ${w.title}.`);
        },
      })),
      { text: 'New workout…', onPress: createNew },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const onDeleteLog = (id: number) => {
    Alert.alert('Remove this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  };

  const progressData = [...logs]
    .filter((l) => l.weight_kg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, value: l.weight_kg ?? 0 }));

  return (
    <ScreenContainer scroll={false} padded={false}>
      <Stack.Screen options={{ title: exercise.name }} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl }} showsVerticalScrollIndicator={false}>
          {tab === 'about' ? (
            <View style={{ gap: theme.spacing.lg }}>
              {exercise.imageUrl ? (
                <Image source={{ uri: exercise.imageUrl }} style={{ width: '100%', height: 220, borderRadius: theme.radius.lg }} resizeMode="cover" />
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                <ActionPill icon="logo-youtube" iconColor={theme.colors.danger} label="YouTube" onPress={onOpenYoutube} />
                <ActionPill icon="share-social-outline" label="Share" onPress={onShare} />
                <ActionPill icon="timer-outline" label="Start timer" onPress={onStartTimer} />
                <ActionPill icon="add-circle-outline" label="Add to workout" onPress={onAddToWorkout} />
              </View>

              <Card style={{ gap: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                  Target muscles
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {exercise.muscles.map((m) => (
                    <View key={m} style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.moduleTasksMuted }}>
                      <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>{m}</Text>
                    </View>
                  ))}
                  {exercise.musclesSecondary.map((m) => (
                    <View key={m} style={{ paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{m}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              {exercise.equipment.length > 0 ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Equipment
                  </Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{exercise.equipment.join(', ')}</Text>
                </Card>
              ) : null}

              {exercise.description ? (
                <Card style={{ gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    How to
                  </Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>{exercise.description}</Text>
                </Card>
              ) : null}

              <Card style={{ gap: theme.spacing.md }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                  Log a set
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <TextField label="Sets" placeholder="3" value={sets} onChangeText={setSets} keyboardType="number-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField label="Reps" placeholder="10" value={reps} onChangeText={setReps} keyboardType="number-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField label="Weight kg" placeholder="20" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
                  </View>
                </View>
                <Button label="Log set" onPress={onLogSet} loading={saving} disabled={!sets.trim() && !reps.trim() && !weight.trim()} />
              </Card>

              {restSecondsLeft !== null ? (
                <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    Rest timer
                  </Text>
                  <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
                    {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, '0')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Pressable onPress={() => setRestSecondsLeft((s) => (s ?? 0) + 30)}>
                      <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        +30s
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setRestSecondsLeft(null)}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                        Skip
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ) : null}
            </View>
          ) : null}

          {tab === 'history' ? (
            loading ? (
              <LoadingState />
            ) : logs.length === 0 ? (
              <EmptyState icon="time-outline" title="No sets logged yet" subtitle="Log a set from the About tab to start tracking this exercise." />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {logs.map((log) => (
                  <Pressable key={log.id} onLongPress={() => onDeleteLog(log.id)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>
                          {[log.sets ? `${log.sets} sets` : null, log.reps ? `${log.reps} reps` : null, log.weight_kg ? `${log.weight_kg} kg` : null]
                            .filter(Boolean)
                            .join(' · ') || 'Logged'}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>{formatDisplayDate(log.date)}</Text>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )
          ) : null}

          {tab === 'progress' ? (
            progressData.length < 2 ? (
              <EmptyState icon="stats-chart-outline" title="Not enough data yet" subtitle="Log weight for a few sets to see your progress trend." />
            ) : (
              <Card>
                <TrendChart label="Weight over time (kg)" data={progressData} color={theme.colors.moduleTasks} />
              </Card>
            )
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            marginBottom: FLOATING_TAB_BAR_CLEARANCE,
          }}>
          {(
            [
              { key: 'about', label: 'About', icon: 'information-circle-outline' },
              { key: 'history', label: 'History', icon: 'time-outline' },
              { key: 'progress', label: 'Progress', icon: 'stats-chart-outline' },
            ] as const
          ).map((entry) => {
            const active = tab === entry.key;
            return (
              <Pressable
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: theme.spacing.sm }}>
                <Ionicons name={entry.icon} size={20} color={active ? theme.colors.moduleTasks : theme.colors.textTertiary} />
                <Text style={{ color: active ? theme.colors.moduleTasks : theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

function ActionPill({
  icon,
  iconColor,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <Ionicons name={icon} size={16} color={iconColor ?? theme.colors.textSecondary} />
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>{label}</Text>
    </Pressable>
  );
}
