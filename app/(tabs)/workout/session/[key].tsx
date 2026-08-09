import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, Share, Text, View } from 'react-native';

import { Button, Card, EmptyState, ExerciseMotionPreview, ScreenContainer } from '@/components';
import { COOL_DOWN_EXERCISES, computeWorkoutStreak, useCustomWorkouts, useWorkoutLogs, WARM_UP_EXERCISES, WORKOUTS } from '@/modules/workout';
import { useAppTheme } from '@/theme';

type Phase = 'warmup' | 'main' | 'cooldown';

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

const PHASE_LABEL: Record<Phase, string> = { warmup: 'Warm-Up', main: '', cooldown: 'Cool-Down' };

export default function WorkoutSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { workouts: customWorkouts } = useCustomWorkouts();
  const workout = useMemo(() => [...WORKOUTS, ...customWorkouts].find((w) => w.key === key), [customWorkouts, key]);
  const { logs, logCompletion } = useWorkoutLogs();

  const [phase, setPhase] = useState<Phase>('warmup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [exerciseSecondsLeft, setExerciseSecondsLeft] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finished, setFinished] = useState(false);

  const steps = phase === 'warmup' ? WARM_UP_EXERCISES : phase === 'cooldown' ? COOL_DOWN_EXERCISES : (workout?.exercises ?? []);
  const totalSteps = steps.length;
  const clampedIndex = Math.min(currentIndex, Math.max(totalSteps - 1, 0));
  const isLastStep = currentIndex >= totalSteps - 1;
  const current = totalSteps > 0 ? parseExerciseLine(steps[clampedIndex]) : { name: '', detail: null as string | null };
  const phaseLabel = phase === 'main' ? (workout?.title ?? '') : PHASE_LABEL[phase];

  const finishSession = async () => {
    if (!workout) return;
    setFinished(true);
    await logCompletion(workout.key, undefined, elapsedSeconds);
  };

  const onAdvance = (startRest: boolean) => {
    if (!isLastStep) {
      if (startRest && phase === 'main') setRestSecondsLeft(60);
      setCurrentIndex((i) => i + 1);
      return;
    }
    if (phase === 'warmup') {
      setPhase('main');
      setCurrentIndex(0);
      setRestSecondsLeft(null);
      return;
    }
    if (phase === 'main') {
      setPhase('cooldown');
      setCurrentIndex(0);
      setRestSecondsLeft(null);
      return;
    }
    finishSession();
  };

  const skipToMain = () => {
    setPhase('main');
    setCurrentIndex(0);
    setRestSecondsLeft(null);
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

  // Once rest (if any) clears, arm an auto-countdown for timed steps — reruns whenever the phase,
  // step, or rest state changes, using `current.detail` from this same render.
  useEffect(() => {
    if (finished || restSecondsLeft !== null) return;
    setExerciseSecondsLeft(parseDurationSeconds(current.detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, restSecondsLeft, finished]);

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
    Share.share({ message: `Just crushed "${workout.title}" on Flowsy! 🔥 ${streak} day streak. Session took ${formatClock(elapsedSeconds)}.` });
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
      </ScreenContainer>
    );
  }

  const showMotion = phase !== 'main' || workout.goal === 'flexibility';

  const primaryLabel =
    isLastStep && phase === 'cooldown'
      ? 'Finish workout'
      : isLastStep && phase === 'main'
        ? 'Start Cool-Down'
        : isLastStep && phase === 'warmup'
          ? 'Start Workout'
          : phase === 'main'
            ? 'Mark done & rest'
            : 'Next';

  return (
    <ScreenContainer scroll={false}>
      <Stack.Screen options={{ title: phaseLabel || workout.title }} />
      <View style={{ flex: 1, gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {phaseLabel} · {clampedIndex + 1} of {totalSteps}
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

        <Card style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing['2xl'] }}>
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

        {phase === 'warmup' ? (
          <Pressable onPress={skipToMain} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Skip warm-up</Text>
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }} />

        <View style={{ gap: theme.spacing.md }}>
          <Button label={primaryLabel} onPress={() => onAdvance(true)} />
          {!(isLastStep && phase === 'cooldown') ? <Button label="Skip this one" variant="secondary" onPress={() => onAdvance(false)} /> : null}
          {phase === 'cooldown' ? (
            <Pressable onPress={finishSession} style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Skip cool-down & finish</Text>
            </Pressable>
          ) : (
            <Pressable onPress={finishSession} style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>Finish now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
