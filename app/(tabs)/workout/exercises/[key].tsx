import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';

import { Button, Card, EmptyState, ExerciseMuscleDiagram, IconBadge, LoadingState, PrBanner, ScreenContainer, SegmentedControl, TextField, TrendChart, showAlert } from '@/components';
import { formatDisplayDate, todayKey } from '@/lib/date';
import { bestWeightKg, isNewWeightPr, useCustomWorkouts, useExerciseCatalog, useExerciseLogs, useRecentExercises } from '@/modules/workout';
import { useAppTheme } from '@/theme';

type DetailTab = 'about' | 'history' | 'progress';

export default function ExerciseDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { exercises: catalog, loading: catalogLoading } = useExerciseCatalog();
  const exercise = catalog.find((e) => e.key === key);
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
  const [justHitPr, setJustHitPr] = useState(false);

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
    if (catalogLoading) {
      return (
        <ScreenContainer>
          <LoadingState />
        </ScreenContainer>
      );
    }
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Exercise not found" />
      </ScreenContainer>
    );
  }

  const onLogSet = async () => {
    setSaving(true);
    try {
      const weightKg = weight.trim() ? Number(weight) : null;
      // Checked against the logs already loaded (pre-insert), so this set isn't compared
      // against itself once addLog below writes it.
      const isPr = isNewWeightPr(logs, weightKg);
      await addLog({
        date: todayKey(),
        sets: sets.trim() ? Math.round(Number(sets)) : null,
        reps: reps.trim() ? Math.round(Number(reps)) : null,
        weightKg,
      });
      setSets('');
      setReps('');
      setWeight('');
      setRestSecondsLeft(60);
      setJustHitPr(isPr);
    } finally {
      setSaving(false);
    }
  };

  const personalBestKg = bestWeightKg(logs);

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
    showAlert('Add to workout', `Add "${exercise.name}" to which workout?`, [
      ...customWorkouts.map((w) => ({
        text: w.title,
        onPress: async () => {
          await addExerciseToWorkout(w.key, exercise.name);
          showAlert('Added', `Added ${exercise.name} to ${w.title}.`);
        },
      })),
      { text: 'New workout…', onPress: createNew },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const onDeleteLog = (id: number) => {
    showAlert('Remove this entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLog(id) },
    ]);
  };

  const progressData = [...logs]
    .filter((l) => l.weight_kg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({ date: l.date, value: l.weight_kg ?? 0 }));

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: exercise.name }} />
      <View style={{ gap: theme.spacing.xl }}>
        <SegmentedControl
          options={[
            { value: 'about', label: 'About' },
            { value: 'history', label: 'History' },
            { value: 'progress', label: 'Progress' },
          ]}
          value={tab}
          onChange={setTab}
        />

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
                <ExerciseMuscleDiagram muscles={exercise.muscles} musclesSecondary={exercise.musclesSecondary} />
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

              {justHitPr ? <PrBanner label={`${exercise.name} · ${weight || personalBestKg} kg`} /> : null}

              <Card style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    Log a set
                  </Text>
                  {personalBestKg != null ? (
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      Personal Best: {personalBestKg} kg
                    </Text>
                  ) : null}
                </View>
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
                <Button label="Log set" onPress={onLogSet} loading={saving} disabled={!sets.trim() && !reps.trim() && !weight.trim()} glow />
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
                      <IconBadge name="barbell" color={theme.colors.moduleTasks} size="sm" />
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
