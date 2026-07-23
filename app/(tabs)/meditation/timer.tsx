import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip, EmptyState, ScreenContainer } from '@/components';
import { useMeditationLogs } from '@/modules/meditation';
import { useAppTheme } from '@/theme';

const PRESETS_MINUTES = [3, 5, 10, 15, 20];
const MIN_LOGGABLE_SECONDS = 5;

export default function FreeformTimerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { logSession } = useMeditationLogs();

  const [durationMinutes, setDurationMinutes] = useState(10);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durationSeconds = durationMinutes * 60;

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const finishTimer = async (completedFully: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
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

  const start = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((current) => {
        const next = current + 1;
        if (next >= durationSeconds) {
          finishTimer(true);
          return durationSeconds;
        }
        return next;
      });
    }, 1000);
  };

  const pause = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  if (finished) {
    return (
      <ScreenContainer>
        <EmptyState icon="checkmark-circle" title="Nice sit" subtitle={`${durationMinutes} minutes logged.`} ctaLabel="Done" onPressCta={() => router.back()} />
      </ScreenContainer>
    );
  }

  const remaining = durationSeconds - elapsed;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'] }}>
        {elapsed === 0 ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
              Choose a duration
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
          </View>
        ) : null}

        <Text
          style={{
            textAlign: 'center',
            color: theme.colors.textPrimary,
            fontSize: 56,
            fontWeight: theme.typography.weight.bold,
            fontVariant: ['tabular-nums'],
          }}>
          {minutes}:{seconds}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
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
