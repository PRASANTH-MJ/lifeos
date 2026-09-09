import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button, Card, EmptyState, ExerciseMotionPreview, ScreenContainer, ShareCardModal, type ShareCardData } from '@/components';
import { computeWorkoutStreak, useCustomWorkouts, useWorkoutLogs, WORKOUTS } from '@/modules/workout';
import { useAppTheme } from '@/theme';

function parseExerciseLine(line: string): { name: string; detail: string | null } {
  const emDashIndex = line.indexOf('—');
  if (emDashIndex !== -1) {
    return { name: line.slice(0, emDashIndex).trim(), detail: line.slice(emDashIndex + 1).trim() };
  }
  const hyphenMatch = line.match(/^(.*?)\s-\s(.*)$/);
  if (hyphenMatch) return { name: hyphenMatch[1].trim(), detail: hyphenMatch[2].trim() };
  return { name: line, detail: null };
}

/** Recognizes a leading duration like "30s" or "5 min" so timed exercises (holds, cardio
 * intervals) auto-countdown instead of sitting static — rep-based details ("3x10", "12 reps")
 * don't match this pattern and fall back to manual "Mark done" pacing. */
function parseDurationSeconds(detail: string | null): number | null {
  if (!detail) return null;
  const match = detail.trim().match(/^(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return match[2].toLowerCase().startsWith('min') ? value * 60 : value;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function WorkoutSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { workouts: customWorkouts } = useCustomWorkouts();
  const workout = useMemo(() => [...WORKOUTS, ...customWorkouts].find((w) => w.key === key), [customWorkouts, key]);
  const { logs, logCompletion } = useWorkoutLogs();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [shareCard, setShareCard] = useState<ShareCardData | null>(null);

  const totalSteps = workout?.exercises.length ?? 0;
  const clampedIndex = Math.min(currentIndex, Math.max(totalSteps - 1, 0));
  const isLastStep = currentIndex >= totalSteps - 1;

  const current = totalSteps > 0 ? parseExerciseLine(workout!.exercises[clampedIndex]) : { name: '', detail: null as string | null };

  // Bracket grouped exercises together even in this one-at-a-time player, not just the flat
  // workout-detail list — "also in this superset" names the OTHER exercises sharing the current
  // one's group so it's clear this isn't a fully standalone step.
  const currentGroup = workout?.exerciseGroups?.[clampedIndex] ?? null;
  const supersetPartners =
    currentGroup != null && workout
      ? workout.exercises.filter((_, i) => i !== clampedIndex && workout.exerciseGroups?.[i] === currentGroup).map((line) => parseExerciseLine(line).name)
      : [];

  const finishSession = async () => {
    if (!workout) return;
    setFinished(true);
    await logCompletion(workout.key, undefined, elapsedSeconds);
  };

  const onAdvance = (startRest: boolean) => {
    if (!isLastStep) {
      if (startRest) setRestSecondsLeft(60);
      setCurrentIndex((i) => i + 1);
      return;
    }
    finishSession();
  };

  // Kept fresh every render so the auto-advance effect below never calls a stale closure.
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

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

  // Once rest (if any) clears, arm an auto-countdown for timed steps — reruns whenever the step
  // or rest state changes, using `current.detail` from this same render.
  useEffect(() => {
    if (finished || restSecondsLeft !== null) return;
    setExerciseSecondsLeft(parseDurationSeconds(current.detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, restSecondsLeft, finished]);

  useEffect(() => {
    if (exerciseSecondsLeft === null) return;
    if (exerciseSecondsLeft <= 0) {
      onAdvanceRef.current(true);
      return;
    }
    const timeout = setTimeout(() => setExerciseSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(timeout);
  }, [exerciseSecondsLeft]);

  if (!workout) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Workout not found" />
      </ScreenContainer>
    );
  }

  const streak = computeWorkoutStreak([...logs, { completed_at: new Date().toISOString() }]);

  const onShare = () => {
    setShareCard({
      eyebrow: workout.title,
      value: String(streak),
      valueLabel: `day streak${streak === 1 ? '' : 's'}`,
      detail: formatClock(elapsedSeconds),
      icon: 'flame',
      accentColor: theme.colors.moduleTasks,
    });
  };

  const onOpenYoutube = () => {
    Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${current.name} how to`)}`);
  };

  if (finished) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Workout complete', headerBackVisible: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
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
            {workout.title} · {formatClock(elapsedSeconds)}
          </Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
            {streak} day{streak === 1 ? '' : 's'} streak!
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, width: '100%', paddingHorizontal: theme.spacing.xl }}>
            <View style={{ flex: 1 }}>
              <Button label="Share" variant="secondary" onPress={onShare} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Done" onPress={() => router.replace('/workout')} />
            </View>
          </View>
        </View>
        <ShareCardModal visible={!!shareCard} onClose={() => setShareCard(null)} data={shareCard} />
      </ScreenContainer>
    );
  }

  const showMotion = workout.goal === 'flexibility';
  const primaryLabel = isLastStep ? 'Finish workout' : 'Mark done & rest';

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: workout.title }} />
      <View style={{ flex: 1, gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {clampedIndex + 1} of {totalSteps}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="stopwatch-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
              {formatClock(elapsedSeconds)}
            </Text>
          </View>
        </View>

        <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' }}>
          <View
            style={{
              height: 6,
              width: `${Math.round((clampedIndex / Math.max(totalSteps - 1, 1)) * 100)}%`,
              backgroundColor: theme.colors.moduleTasks,
            }}
          />
        </View>

        <Card
          style={{
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing['2xl'],
            borderLeftWidth: supersetPartners.length > 0 ? 3 : undefined,
            borderLeftColor: supersetPartners.length > 0 ? theme.colors.moduleTasks : undefined,
          }}>
          {supersetPartners.length > 0 ? (
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.bold }}>
              SUPERSET · ALSO: {supersetPartners.join(', ')}
            </Text>
          ) : null}
          {showMotion ? <ExerciseMotionPreview name={current.name} /> : null}
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
            {current.name}
          </Text>
          {exerciseSecondsLeft !== null ? (
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
              {formatClock(exerciseSecondsLeft)}
            </Text>
          ) : current.detail ? (
            <Text style={{ color: theme.colors.moduleTasks, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.semibold }}>
              {current.detail}
            </Text>
          ) : null}
          <Pressable onPress={onOpenYoutube} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.xs }}>
            <Ionicons name="logo-youtube" size={14} color={theme.colors.danger} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
              How to
            </Text>
          </Pressable>
        </Card>

        {restSecondsLeft !== null ? (
          <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Rest before next
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

        <View style={{ flex: 1 }} />

        <View style={{ gap: theme.spacing.md }}>
          <Button label={primaryLabel} onPress={() => onAdvance(true)} glow />
          {!isLastStep ? <Button label="Skip this one" variant="secondary" onPress={() => onAdvance(false)} /> : null}
          <Pressable onPress={finishSession} style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Finish now</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}
