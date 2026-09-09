import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BreathingOrb, Card, Chip, CountdownDisplay, EmptyState, PostToFeedPrompt, ScreenContainer, type ShareCardData } from '@/components';
import { MEDITATION_TRACKS, findChakra, findTrack, useAmbientSoundOverride, useCountdownSession, useMeditationLogs } from '@/modules/meditation';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useActiveTimerNotification } from '@/notifications/useActiveTimerNotification';
import { useAppTheme } from '@/theme';
import { withAlpha } from '@/theme/withAlpha';

const MIN_LOGGABLE_SECONDS = 5;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function ChakraSessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { chakraKey } = useLocalSearchParams<{ chakraKey: string }>();
  const chakra = findChakra(chakraKey);
  const { logSession } = useMeditationLogs();
  const { overrideKey, loading: loadingOverride, setOverrideKey } = useAmbientSoundOverride();
  const streak = useMindfulnessStreak();

  const durationSeconds = chakra?.durationSeconds ?? 4 * 60;
  const [trackKey, setTrackKey] = useState(chakra?.audioTrackKey ?? 'moonstone');
  // Same one-time override apply as the guided session screen (see [sessionKey].tsx) — for
  // consistency, the chakra flow remembers and starts from the same last-picked sound.
  const appliedOverrideRef = useRef(false);
  useEffect(() => {
    if (loadingOverride || appliedOverrideRef.current) return;
    appliedOverrideRef.current = true;
    if (overrideKey) setTrackKey(overrideKey);
  }, [loadingOverride, overrideKey]);
  const track = findTrack(trackKey);
  const player = useAudioPlayer(track.audioSource);
  const { elapsed, running, start, pause, completedAt } = useCountdownSession(durationSeconds);
  const [finished, setFinished] = useState(false);

  useActiveTimerNotification({
    enabled: running,
    title: chakra ? `${chakra.name} chakra` : 'Meditation',
    body: `${formatClock(Math.max(durationSeconds - elapsed, 0))} left`,
  });

  useEffect(() => {
    player.loop = true;
    return () => {
      // useAudioPlayer() already releases the native player on unmount (per its own docs) —
      // navigating back while a session is playing can race this pause() against that release,
      // which throws a native exception (crashing the whole app) rather than a catchable JS
      // error. Nothing meaningful to do here if the player's already gone, so just swallow it.
      try {
        player.pause();
      } catch {}
    };
  }, [player]);

  const finishSession = async (completedFully: boolean) => {
    pause();
    try {
      player.pause();
    } catch {}
    const secondsToLog = completedFully ? durationSeconds : elapsed;
    // Prefixed so it reads distinctly in history/logs from a regular guided session key, while
    // still just being a plain string in meditation_logs.session_key — it already counts toward
    // the same totalMinutesThisWeek/streak queries, which group by completed_at, not session_key.
    if (secondsToLog >= MIN_LOGGABLE_SECONDS && chakra) {
      await logSession(`chakra-${chakra.key}`, secondsToLog);
    }
    if (completedFully) {
      setFinished(true);
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (completedAt > 0) finishSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt]);

  const togglePlayback = () => {
    if (running) {
      try {
        player.pause();
      } catch {}
      pause();
      return;
    }
    player.play();
    start();
  };

  const onSelectTrack = (key: string) => {
    setTrackKey(key);
    setOverrideKey(key);
    if (running) {
      try {
        player.pause();
      } catch {}
      pause();
    }
  };

  if (!chakra) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Chakra not found" />
      </ScreenContainer>
    );
  }

  const chakraShareCard: ShareCardData = {
    eyebrow: `${chakra.name} chakra`,
    value: String(Math.round(durationSeconds / 60)),
    valueLabel: 'min meditated',
    detail: `${streak} day streak${streak === 1 ? '' : 's'}`,
    icon: 'sparkles',
    accentColor: chakra.color,
  };

  if (finished) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
          <EmptyState
            icon="checkmark-circle"
            title="Session complete"
            subtitle={`You focused on your ${chakra.name} chakra for ${Math.round(durationSeconds / 60)} minutes.`}
          />
          <View style={{ width: '100%', paddingHorizontal: theme.spacing.xl }}>
            <PostToFeedPrompt
              type="milestone"
              card={chakraShareCard}
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
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'], backgroundColor: withAlpha(chakra.color, 0.06) }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
            {chakra.name} · {chakra.sanskritName}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, textAlign: 'center' }}>
            {chakra.theme}
          </Text>
        </View>

        <Card tier="panel" style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing['2xl'] }}>
          <Text style={{ color: chakra.color, fontSize: 64, fontWeight: theme.typography.weight.bold, letterSpacing: 2 }}>
            {chakra.mantra}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center', paddingHorizontal: theme.spacing.xl }}>
            {chakra.description}
          </Text>
        </Card>

        {elapsed === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
              Change sound
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
              {MEDITATION_TRACKS.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={trackKey === option.key}
                  onPress={() => onSelectTrack(option.key)}
                  color={chakra.color}
                  mutedColor={withAlpha(chakra.color, 0.16)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <CountdownDisplay remainingSeconds={remaining} progress={progress} color={chakra.color} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
          <BreathingOrb active={running} color={chakra.color} size={100}>
            <Pressable
              onPress={togglePlayback}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radius.full,
                backgroundColor: chakra.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name={running ? 'pause' : 'play'} size={30} color="#fff" />
            </Pressable>
          </BreathingOrb>
        </View>

        {elapsed > 0 ? (
          <Pressable onPress={() => finishSession(false)} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>End session</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
