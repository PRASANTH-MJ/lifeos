import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, IconBadge, PostToFeedPrompt, PrBanner, ScreenContainer, ShareCardModal, TextField, showAlert, type ShareCardData } from '@/components';
import { FLOATING_TAB_BAR_CLEARANCE_HIDDEN } from '@/components/tabBarMetrics';
import { todayKey } from '@/lib/date';
import { useActiveTimerNotification } from '@/notifications/useActiveTimerNotification';
import {
  bestWeightKg,
  computeSessionVolume,
  computeWorkoutStreak,
  formatClock,
  insertExerciseLog,
  isNewWeightPr,
  openExercisePicker,
  useExerciseCatalog,
  useWorkoutLogs,
} from '@/modules/workout';
import { useAppTheme } from '@/theme';

type SetRow = { reps: string; weightKg: string; done: boolean };
type SessionExercise = { exerciseKey: string; sets: SetRow[] };

const QUICK_SESSION_WORKOUT_KEY = 'quick-session';

export default function LiveSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { keys } = useLocalSearchParams<{ keys: string }>();
  const initialKeys = useMemo(() => (keys ? keys.split(',').filter(Boolean) : []), [keys]);
  const { exercises: catalog } = useExerciseCatalog();
  const { logs, logCompletion } = useWorkoutLogs();

  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>(
    initialKeys.map((exerciseKey) => ({ exerciseKey, sets: [{ reps: '', weightKg: '', done: false }] }))
  );
  const [previousByKey, setPreviousByKey] = useState<Record<string, { reps: number | null; weightKg: number | null }>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);
  const [prExerciseNames, setPrExerciseNames] = useState<string[]>([]);

  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [finished]);

  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) {
      setRestSecondsLeft(null);
      return;
    }
    const timeout = setTimeout(() => setRestSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timeout);
  }, [restSecondsLeft]);

  // One bulk query for every picked exercise's most recent log, instead of a hook per card.
  useEffect(() => {
    if (initialKeys.length === 0) return;
    (async () => {
      const placeholders = initialKeys.map(() => '?').join(',');
      const rows = await db.getAllAsync<{ exercise_key: string; reps: number | null; weight_kg: number | null }>(
        `SELECT exercise_key, reps, weight_kg FROM exercise_logs WHERE exercise_key IN (${placeholders}) ORDER BY created_at DESC`,
        initialKeys
      );
      const latest: Record<string, { reps: number | null; weightKg: number | null }> = {};
      for (const row of rows) {
        if (!(row.exercise_key in latest)) latest[row.exercise_key] = { reps: row.reps, weightKg: row.weight_kg };
      }
      setPreviousByKey(latest);

      // Auto-fill each exercise's first set with what you logged last time — editable, not
      // locked, so it's a starting point to confirm/adjust rather than something retyped from
      // scratch every session.
      setSessionExercises((current) =>
        current.map((exercise) => {
          const previous = latest[exercise.exerciseKey];
          if (!previous) return exercise;
          return {
            ...exercise,
            sets: exercise.sets.map((set, index) =>
              index === 0 && !set.reps && !set.weightKg
                ? {
                    ...set,
                    reps: previous.reps != null ? String(previous.reps) : set.reps,
                    weightKg: previous.weightKg != null ? String(previous.weightKg) : set.weightKg,
                  }
                : set
            ),
          };
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSetsDone = sessionExercises.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0);
  const totalVolume = computeSessionVolume(sessionExercises);

  useActiveTimerNotification({
    enabled: !finished,
    title: 'Workout in progress',
    body: `${formatClock(elapsedSeconds)} · ${totalSetsDone} set${totalSetsDone === 1 ? '' : 's'} done`,
  });

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<SetRow>) => {
    if (patch.done) setRestSecondsLeft(60);
    setSessionExercises((current) =>
      current.map((exercise, ei) =>
        ei !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.map((set, si) => (si !== setIndex ? set : { ...set, ...patch })) }
      )
    );
  };

  const addSet = (exerciseIndex: number) => {
    setSessionExercises((current) =>
      current.map((exercise, ei) => {
        if (ei !== exerciseIndex) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        return { ...exercise, sets: [...exercise.sets, { reps: last?.reps ?? '', weightKg: last?.weightKg ?? '', done: false }] };
      })
    );
  };

  const onAddExercises = () => {
    openExercisePicker(router, async (picked) => {
      const newPicked = picked.filter((p) => !sessionExercises.some((e) => e.exerciseKey === p.key));
      if (newPicked.length === 0) return;

      const placeholders = newPicked.map(() => '?').join(',');
      const rows = await db.getAllAsync<{ exercise_key: string; reps: number | null; weight_kg: number | null }>(
        `SELECT exercise_key, reps, weight_kg FROM exercise_logs WHERE exercise_key IN (${placeholders}) ORDER BY created_at DESC`,
        newPicked.map((p) => p.key)
      );
      const latest: Record<string, { reps: number | null; weightKg: number | null }> = {};
      for (const row of rows) {
        if (!(row.exercise_key in latest)) latest[row.exercise_key] = { reps: row.reps, weightKg: row.weight_kg };
      }
      setPreviousByKey((current) => ({ ...current, ...latest }));

      setSessionExercises((current) => [
        ...current,
        ...newPicked.map((p) => {
          const previous = latest[p.key];
          return {
            exerciseKey: p.key,
            sets: [{ reps: previous?.reps != null ? String(previous.reps) : '', weightKg: previous?.weightKg != null ? String(previous.weightKg) : '', done: false }],
          };
        }),
      ]);
    });
  };

  const onFinish = async () => {
    setSaving(true);
    try {
      // Prior best per exercise, queried once up front (pre-insert) so each exercise's own new
      // sets below are checked against last session's max, not against each other mid-loop.
      const keysWithSets = sessionExercises.filter((e) => e.sets.some((s) => s.done)).map((e) => e.exerciseKey);
      const priorBestByKey: Record<string, number | null> = {};
      if (keysWithSets.length > 0) {
        const placeholders = keysWithSets.map(() => '?').join(',');
        const rows = await db.getAllAsync<{ exercise_key: string; weight_kg: number | null }>(
          `SELECT exercise_key, weight_kg FROM exercise_logs WHERE exercise_key IN (${placeholders})`,
          keysWithSets
        );
        for (const key of keysWithSets) priorBestByKey[key] = bestWeightKg(rows.filter((r) => r.exercise_key === key));
      }

      const newPrKeys = new Set<string>();
      for (const exercise of sessionExercises) {
        for (const set of exercise.sets) {
          if (!set.done) continue;
          const weightKg = set.weightKg.trim() ? Number(set.weightKg) : null;
          if (isNewWeightPr([{ weight_kg: priorBestByKey[exercise.exerciseKey] ?? null }], weightKg)) {
            newPrKeys.add(exercise.exerciseKey);
            priorBestByKey[exercise.exerciseKey] = weightKg;
          }
          await insertExerciseLog(db, exercise.exerciseKey, {
            date: todayKey(),
            sets: 1,
            reps: set.reps.trim() ? Number(set.reps) : null,
            weightKg,
          });
        }
      }
      setPrExerciseNames([...newPrKeys].map((key) => catalog.find((e) => e.key === key)?.name ?? key));
      await logCompletion(QUICK_SESSION_WORKOUT_KEY, undefined, elapsedSeconds);
      setFinished(true);
    } finally {
      setSaving(false);
    }
  };

  const streak = computeWorkoutStreak([...logs, { completed_at: new Date().toISOString() }]);

  // Nothing is persisted until "Finish workout" (insertExerciseLog only runs in onFinish), so
  // cancelling mid-session is always safe — no cleanup needed, just a confirm to guard against an
  // accidental tap losing typed-but-unsaved sets. headerBackVisible is off for this route (a swipe
  // or hardware-back shouldn't silently drop an in-progress session), so this explicit close button
  // is the only way out — without it, a user who wants to abandon a session has no affordance at all.
  const onCancel = () => {
    showAlert('Cancel this workout?', 'Nothing has been saved yet — your logged sets will be lost.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Cancel workout', style: 'destructive', onPress: () => router.replace('/workout') },
    ]);
  };

  const roundedVolume = Math.round(totalVolume);
  const workoutShareCard: ShareCardData =
    roundedVolume > 0
      ? {
          eyebrow: 'Workout complete',
          value: String(roundedVolume),
          valueLabel: 'kg lifted',
          detail: `${totalSetsDone} set${totalSetsDone === 1 ? '' : 's'} · ${formatClock(elapsedSeconds)} · ${streak} day streak`,
          icon: 'barbell',
          accentColor: theme.colors.moduleTasks,
        }
      : {
          eyebrow: 'Workout complete',
          value: String(streak),
          valueLabel: `day streak${streak === 1 ? '' : 's'}`,
          detail: `${totalSetsDone} set${totalSetsDone === 1 ? '' : 's'} · ${formatClock(elapsedSeconds)}`,
          icon: 'flame',
          accentColor: theme.colors.moduleTasks,
        };

  const onShare = () => setShareCard(workoutShareCard);

  // Volume/Sets/Time — the three-row layout PhotoStoryTemplate overlays on a gym photo.
  const workoutShareStats = [
    { label: 'Volume', value: `${roundedVolume} kg` },
    { label: 'Sets', value: String(totalSetsDone) },
    { label: 'Time', value: formatClock(elapsedSeconds) },
  ];

  if (finished) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Workout complete', headerBackVisible: false }} />
        {/* Not flex:1/justifyContent:'center' — this block's real height varies a lot (PR banner,
            template picker, GIF toggle, caption field all conditionally add height), and
            vertically centering it inside the ScrollView made the screen visually read as
            "finished" the instant the first screenful was in view, so people never discovered
            the "Post to Feed" button sitting just below the fold. Plain top-down flow guarantees
            it's always reachable by a normal scroll, not just visible on a tall enough screen. */}
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: theme.colors.warningMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="flame" size={36} color={theme.colors.warning} />
            <Text style={{ color: theme.colors.warning, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>{streak}</Text>
          </View>
          <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
            Crushed it! 🔥
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.base, textAlign: 'center' }}>
            {totalSetsDone} sets · {formatClock(elapsedSeconds)}
          </Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {streak} day{streak === 1 ? '' : 's'} streak!
          </Text>
          {prExerciseNames.length > 0 ? (
            <View style={{ width: '100%', paddingHorizontal: theme.spacing.xl }}>
              <PrBanner label={prExerciseNames.join(' · ')} />
            </View>
          ) : null}
          <Pressable onPress={onShare} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="download-outline" size={14} color={theme.colors.moduleTasks} />
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              Save image
            </Text>
          </Pressable>
          <View style={{ width: '100%', paddingHorizontal: theme.spacing.xl }}>
            <PostToFeedPrompt
              type="milestone"
              card={workoutShareCard}
              stats={workoutShareStats}
              streak={streak}
              streakLabel="WORKOUT STREAK"
              onDone={() => router.replace('/workout')}
            />
          </View>
        </View>
        <ShareCardModal visible={!!shareCard} onClose={() => setShareCard(null)} data={shareCard} />
      </ScreenContainer>
    );
  }

  return (
    // bottomClearance={false} — the Finish-workout row below reserves its own clearance via
    // marginBottom, since /workout hides the floating tab bar (see HIDE_TAB_BAR_PREFIXES); letting
    // ScreenContainer ALSO add its default clearance here double-counted it, pushing the button
    // needlessly high above a large blank strip.
    <ScreenContainer scroll={false} bottomClearance={false}>
      <Stack.Screen
        options={{
          title: 'Workout',
          headerLeft: () => (
            <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel workout">
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          ),
        }}
      />
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <Card tier="panel" style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <IconBadge name="stopwatch-outline" color={theme.colors.moduleTasks} size="sm" />
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {formatClock(elapsedSeconds)}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Duration</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <IconBadge name="barbell-outline" tone="neutral" size="sm" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {Math.round(totalVolume)} kg
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Volume</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <IconBadge name="checkmark-done-outline" tone="neutral" size="sm" />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
              {totalSetsDone}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Sets</Text>
          </View>
        </Card>

        {restSecondsLeft !== null ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Rest before next set
            </Text>
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold }}>
              {formatClock(restSecondsLeft)}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Pressable onPress={() => setRestSecondsLeft((s) => (s ?? 0) + 30)}>
                <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>+30s</Text>
              </Pressable>
              <Pressable onPress={() => setRestSecondsLeft(null)}>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Skip</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }} showsVerticalScrollIndicator={false}>
          {sessionExercises.map((exercise, exerciseIndex) => {
            const catalogExercise = catalog.find((e) => e.key === exercise.exerciseKey);
            const previous = previousByKey[exercise.exerciseKey];
            return (
              <Card key={`${exercise.exerciseKey}-${exerciseIndex}`} style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge name="barbell" color={theme.colors.moduleTasks} size="sm" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.bold }}>
                    {catalogExercise?.name ?? exercise.exerciseKey}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', paddingBottom: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <Text style={{ width: 32, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Set</Text>
                  <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Previous</Text>
                  <Text style={{ width: 64, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Kg</Text>
                  <Text style={{ width: 64, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Reps</Text>
                  <View style={{ width: 32 }} />
                </View>

                {exercise.sets.map((set, setIndex) => (
                  <View key={setIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                    <Text style={{ width: 32, color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                      {setIndex + 1}
                    </Text>
                    <Text style={{ flex: 1, color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                      {previous?.weightKg != null || previous?.reps != null ? `${previous?.weightKg ?? '—'}kg × ${previous?.reps ?? '—'}` : '—'}
                    </Text>
                    <View style={{ width: 64 }}>
                      <TextField
                        value={set.weightKg}
                        onChangeText={(text) => updateSet(exerciseIndex, setIndex, { weightKg: text })}
                        keyboardType="decimal-pad"
                        placeholder="-"
                      />
                    </View>
                    <View style={{ width: 64 }}>
                      <TextField
                        value={set.reps}
                        onChangeText={(text) => updateSet(exerciseIndex, setIndex, { reps: text })}
                        keyboardType="number-pad"
                        placeholder="-"
                      />
                    </View>
                    <Pressable onPress={() => updateSet(exerciseIndex, setIndex, { done: !set.done })} style={{ width: 32, alignItems: 'center' }}>
                      <Ionicons
                        name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={set.done ? theme.colors.success : theme.colors.textTertiary}
                      />
                    </Pressable>
                  </View>
                ))}

                <Pressable onPress={() => addSet(exerciseIndex)}>
                  <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                    + Add Set
                  </Text>
                </Pressable>
              </Card>
            );
          })}

          <Button label="Add Exercises" variant="secondary" onPress={onAddExercises} />
        </ScrollView>

        <View style={{ paddingTop: theme.spacing.sm, marginBottom: FLOATING_TAB_BAR_CLEARANCE_HIDDEN }}>
          <Button label="Finish workout" onPress={onFinish} loading={saving} glow />
        </View>
      </View>
    </ScreenContainer>
  );
}
