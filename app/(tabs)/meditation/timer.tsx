import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BreathingOrb, Card, Chip, CountdownDisplay, EmptyState, PostToFeedPrompt, ScreenContainer, type ShareCardData } from '@/components';
import { useCountdownSession, useMeditationLogs } from '@/modules/meditation';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useAppTheme } from '@/theme';

const PRESETS_MINUTES = [3, 5, 10, 15, 20];
const MIN_LOGGABLE_SECONDS = 5;

export default function FreeformTimerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { logSession } = useMeditationLogs();
  const streak = useMindfulnessStreak();

  const [durationMinutes, setDurationMinutes] = useState(10);
  const durationSeconds = durationMinutes * 60;
  const { elapsed, running, start, pause, completedAt } = useCountdownSession(durationSeconds);
  const [finished, setFinished] = useState(false);

  const finishTimer = async (completedFully: boolean) => {
    pause();
    const secondsToLog = completedFully ? durationSeconds : elapsed;
    if (secondsToLog >= MIN_LOGGABLE_SECONDS) {
      await logSession('freeform', secondsToLog);
    }
    if (completedFully) {
      setFinished(true);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (completedAt > 0) finishTimer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt]);

  const meditationShareCard: ShareCardData = {
    eyebrow: 'Freeform sit',
    value: String(durationMinutes),
    valueLabel: `min meditated`,
    detail: `${streak} day streak${streak === 1 ? '' : 's'}`,
    icon: 'leaf',
    accentColor: theme.colors.moduleJournal,
  };

  if (finished) {
    return (
      <ScreenContainer>
        {/* Not flex:1/justifyContent:'center' — see live-session.tsx's identical fix: centering
            made the screen read as "finished" before scrolling down to "Post to Feed". */}
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <EmptyState icon="checkmark-circle" title="Nice sit" subtitle={`${durationMinutes} minutes logged.`} />
          <View style={{ width: '100%', paddingHorizontal: theme.spacing.xl }}>
            <PostToFeedPrompt
              type="milestone"
              card={meditationShareCard}
              streak={streak}
              streakLabel="MEDITATION STREAK"
              onDone={() => router.back()}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const remaining = durationSeconds - elapsed;
  const progress = elapsed / durationSeconds;

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'] }}>
        {elapsed === 0 ? (
          <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
              Duration
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }}>
              {PRESETS_MINUTES.map((minutesOption) => (
                <Chip
                  key={minutesOption}
                  label={`${minutesOption}m`}
                  selected={durationMinutes === minutesOption}
                  onPress={() => setDurationMinutes(minutesOption)}
                />
              ))}
            </View>
          </Card>
        ) : null}

        <CountdownDisplay remainingSeconds={remaining} progress={progress} color={theme.colors.moduleJournal} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
          <BreathingOrb active={running} color={theme.colors.moduleJournal} size={100}>
            <Pressable
              onPress={running ? pause : start}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.moduleJournal,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={running ? 'pause' : 'play'} size={30} color="#fff" />
            </Pressable>
          </BreathingOrb>
        </View>

        {elapsed > 0 ? (
          <Pressable onPress={() => finishTimer(false)} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>End session</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
