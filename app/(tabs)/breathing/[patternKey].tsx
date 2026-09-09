import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, IconBadge, PostToFeedPrompt, ScreenContainer, type ShareCardData } from '@/components';
import { BreathingBar, BreathingCircle, BreathingFlower, BreathingWave, findPattern, useBreathingCycle, useBreathingLogs } from '@/modules/breathing';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useAppTheme } from '@/theme';

const CYCLE_OPTIONS = [4, 8, 12];
const MIN_LOGGABLE_SECONDS = 5;
const ANIMATION_STYLES = [
  { key: 'circle', label: 'Circle' },
  { key: 'flower', label: 'Flower' },
  { key: 'wave', label: 'Wave' },
  { key: 'bar', label: 'Bar' },
] as const;
type AnimationStyle = (typeof ANIMATION_STYLES)[number]['key'];

export default function BreathingSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { patternKey } = useLocalSearchParams<{ patternKey: string }>();
  const pattern = findPattern(patternKey);
  const { logSession } = useBreathingLogs();
  // Shared with meditation: a day counts toward this streak if either meditation or breathing was
  // logged, since they're two entry points into the same underlying habit (see useMindfulnessStreak).
  const streak = useMindfulnessStreak();

  const [targetCycles, setTargetCycles] = useState(8);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('circle');
  const [finished, setFinished] = useState<{ cycles: number; totalSeconds: number } | null>(null);
  const [started, setStarted] = useState(false);

  const onFinish = useCallback(
    (totalSeconds: number) => {
      if (!pattern) return;
      logSession(pattern.key, totalSeconds, targetCycles);
      setFinished({ cycles: targetCycles, totalSeconds });
    },
    [pattern, targetCycles, logSession]
  );

  const cycle = useBreathingCycle(pattern ?? findPattern('box')!, targetCycles, onFinish);

  if (!pattern) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Pattern not found" />
      </ScreenContainer>
    );
  }

  const onEndEarly = () => {
    cycle.stop();
    if (cycle.totalSeconds >= MIN_LOGGABLE_SECONDS) {
      logSession(pattern.key, cycle.totalSeconds, cycle.cycles);
    }
    router.back();
  };

  if (finished) {
    const breathingShareCard: ShareCardData = {
      eyebrow: pattern.title,
      value: String(finished.cycles),
      valueLabel: `cycle${finished.cycles === 1 ? '' : 's'}`,
      detail: `${Math.round(finished.totalSeconds / 60)} min`,
      icon: 'leaf',
      accentColor: theme.colors.moduleJournal,
    };
    return (
      <ScreenContainer>
        {/* Not flex:1/justifyContent:'center' — see live-session.tsx's identical fix: centering
            made the screen read as "finished" before scrolling down to "Post to Feed". */}
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <EmptyState icon="checkmark-circle" title="Session complete" subtitle={`${finished.cycles} cycles of ${pattern.title}.`} />
          <View style={{ width: '100%', paddingHorizontal: theme.spacing.xl }}>
            <PostToFeedPrompt
              type="milestone"
              card={breathingShareCard}
              streak={streak}
              streakLabel="MINDFULNESS STREAK"
              onDone={() => router.back()}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing['2xl'] }}>
          {!started ? (
            <View style={{ gap: theme.spacing.lg, alignItems: 'center', width: '100%' }}>
              <IconBadge name="pulse" color={theme.colors.moduleTasks} size="lg" />
              <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
                  {pattern.title}
                </Text>
                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center', maxWidth: 260 }}>
                  {pattern.description}
                </Text>
              </View>
              <Card tier="panel" style={{ width: '100%', gap: theme.spacing.md, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Cycles
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  {CYCLE_OPTIONS.map((option) => (
                    <Chip
                      key={option}
                      label={`${option} cycles`}
                      selected={targetCycles === option}
                      onPress={() => setTargetCycles(option)}
                      color={theme.colors.moduleTasks}
                      mutedColor={theme.colors.moduleTasksMuted}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
                  {ANIMATION_STYLES.map((option) => (
                    <Chip
                      key={option.key}
                      label={option.label}
                      selected={animationStyle === option.key}
                      onPress={() => setAnimationStyle(option.key)}
                      color={theme.colors.moduleTasks}
                      mutedColor={theme.colors.moduleTasksMuted}
                    />
                  ))}
                </View>
              </Card>
            </View>
          ) : (
            <>
              {animationStyle === 'flower' ? (
                <BreathingFlower step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
              ) : animationStyle === 'wave' ? (
                <BreathingWave step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
              ) : animationStyle === 'bar' ? (
                <BreathingBar step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
              ) : (
                <BreathingCircle step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
              )}
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                Cycle {Math.min(cycle.cycles + 1, targetCycles)} of {targetCycles}
              </Text>
            </>
          )}
        </View>

        <View style={{ paddingTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          {!started ? (
            <Button
              label="Begin Session"
              glow
              onPress={() => {
                setStarted(true);
                cycle.start();
              }}
            />
          ) : (
            <Pressable onPress={onEndEarly} style={{ alignItems: 'center', paddingVertical: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>End session</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
