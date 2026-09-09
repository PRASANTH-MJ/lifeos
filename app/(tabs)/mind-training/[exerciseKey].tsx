import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyState, IconBadge, PostToFeedPrompt, ScreenContainer, type ShareCardData } from '@/components';
import { GAME_COMPONENTS, findExercise, useMindTrainingLogs } from '@/modules/mind-training';
import { useAppTheme } from '@/theme';

export default function MindExerciseScreen() {
  const theme = useAppTheme();
  const { exerciseKey } = useLocalSearchParams<{ exerciseKey: string }>();
  const exercise = findExercise(exerciseKey);
  const { logScore } = useMindTrainingLogs();
  // A completed round's score, offered for sharing right below the game — not a full-screen
  // "finished" takeover like other modules, since every game here has its own inline "Try again"
  // (see e.g. MathSprintGame) and stays mounted for repeat play. Keyed by attempt number so the
  // prompt (caption, photo) resets fresh each time a new score comes in, rather than carrying over
  // stale state from a previous round the user already posted or skipped.
  const [attempt, setAttempt] = useState<{ n: number; score: number } | null>(null);

  if (!exercise) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Exercise not found" />
      </ScreenContainer>
    );
  }

  const onScore = (score: number) => {
    logScore(exercise.key, score);
    setAttempt((prev) => ({ n: (prev?.n ?? 0) + 1, score }));
  };

  const Game = GAME_COMPONENTS[exercise.key];

  // Mind-training has no day-streak concept the way food/workout/meditation do (see
  // PostToFeedPrompt's `streak` prop doc) — skipped honestly rather than inventing one.
  const scoreShareCard: ShareCardData | null = attempt
    ? {
        eyebrow: exercise.title,
        value: String(attempt.score),
        valueLabel: exercise.scoreLabel.toUpperCase(),
        icon: 'bulb',
        accentColor: theme.colors.primary,
      }
    : null;

  return (
    // Scrollable once a score/share prompt is showing (mirrors every other completion screen's
    // default scroll=true ScreenContainer) — scroll=false only while the game itself is active,
    // since several games (e.g. WhackAMoleGame's tap grid) rely on a fixed, non-scrolling layout.
    <ScreenContainer scroll={attempt != null}>
      <View style={{ flex: attempt ? undefined : 1, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <IconBadge name="bulb" color={theme.colors.primary} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {exercise.title}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{exercise.description}</Text>
          </View>
        </View>
        <Game onScore={onScore} />
        {scoreShareCard ? (
          <PostToFeedPrompt
            key={attempt!.n}
            type="milestone"
            card={scoreShareCard}
            onDone={() => setAttempt(null)}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}
