import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, EmptyState, ScreenContainer } from '@/components';
import { MEDITATION_TRACKS, findSession, findTrack, useMeditationLogs } from '@/modules/meditation';
import { useAppTheme } from '@/theme';

const MIN_LOGGABLE_SECONDS = 5;

export default function MeditationPlayerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { sessionKey } = useLocalSearchParams<{ sessionKey: string }>();
  const session = findSession(sessionKey);
  const { logSession } = useMeditationLogs();

  const [trackKey, setTrackKey] = useState(session?.defaultTrackKey ?? MEDITATION_TRACKS[0].key);
  const track = findTrack(trackKey);
  const player = useAudioPlayer(track.audioSource);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    player.loop = true;
    return () => {
      player.pause();
    };
  }, [player]);

  const onSelectTrack = (key: string) => {
    setTrackKey(key);
    if (running) {
      player.pause();
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!session) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Session not found" />
      </ScreenContainer>
    );
  }

  const finishSession = async (completedFully: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    player.pause();
    const secondsToLog = completedFully ? session.durationSeconds : elapsed;
    if (secondsToLog >= MIN_LOGGABLE_SECONDS) {
      await logSession(session.key, secondsToLog);
    }
    if (completedFully) {
      setFinished(true);
    } else {
      router.back();
    }
  };

  const togglePlayback = () => {
    if (running) {
      player.pause();
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    player.play();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((current) => {
        const next = current + 1;
        if (next >= session.durationSeconds) {
          finishSession(true);
          return session.durationSeconds;
        }
        return next;
      });
    }, 1000);
  };

  if (finished) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="checkmark-circle"
          title="Session complete"
          subtitle={`You sat for ${Math.round(session.durationSeconds / 60)} minutes.`}
          ctaLabel="Done"
          onPressCta={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const remaining = session.durationSeconds - elapsed;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  const progress = elapsed / session.durationSeconds;

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'] }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {session.title}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{session.description}</Text>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
            Music
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
            {MEDITATION_TRACKS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={trackKey === option.key}
                onPress={() => onSelectTrack(option.key)}
                color={theme.colors.moduleJournal}
                mutedColor={theme.colors.moduleJournalMuted}
              />
            ))}
          </View>
        </View>

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

        <Card style={{ height: 8, padding: 0, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(progress * 100, 100)}%`, height: '100%', backgroundColor: theme.colors.moduleJournal }} />
        </Card>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
          <Pressable
            onPress={togglePlayback}
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
          <Pressable onPress={() => finishSession(false)} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>End session</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
