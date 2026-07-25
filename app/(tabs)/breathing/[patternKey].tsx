import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip, EmptyState, ScreenContainer } from '@/components';
import { BreathingCircle, BreathingFlower, findPattern, useBreathingCycle, useBreathingLogs } from '@/modules/breathing';
import { useAppTheme } from '@/theme';

const CYCLE_OPTIONS = [4, 8, 12];
const MIN_LOGGABLE_SECONDS = 5;
const ANIMATION_STYLES = [
  { key: 'circle', label: 'Circle' },
  { key: 'flower', label: 'Flower' },
] as const;
type AnimationStyle = (typeof ANIMATION_STYLES)[number]['key'];

export default function BreathingSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { patternKey } = useLocalSearchParams<{ patternKey: string }>();
  const pattern = findPattern(patternKey);
  const { logSession } = useBreathingLogs();

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
    return (
      <ScreenContainer>
        <EmptyState
          icon="checkmark-circle"
          title="Session complete"
          subtitle={`${finished.cycles} cycles of ${pattern.title}.`}
          ctaLabel="Done"
          onPressCta={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing['2xl'] }}>
        {!started ? (
          <View style={{ gap: theme.spacing.lg, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
              {pattern.title}
            </Text>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm, textAlign: 'center', maxWidth: 260 }}>
              {pattern.description}
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
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
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
            <Pressable
              onPress={() => {
                setStarted(true);
                cycle.start();
              }}
              style={{
                paddingHorizontal: theme.spacing['2xl'],
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.moduleTasks,
              }}>
              <Text style={{ color: '#fff', fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>Begin</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {animationStyle === 'flower' ? (
              <BreathingFlower step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
            ) : (
              <BreathingCircle step={cycle.step} secondsLeft={cycle.secondsLeft} color={theme.colors.moduleTasks} />
            )}
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
              Cycle {Math.min(cycle.cycles + 1, targetCycles)} of {targetCycles}
            </Text>
            <Pressable onPress={onEndEarly}>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>End session</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
