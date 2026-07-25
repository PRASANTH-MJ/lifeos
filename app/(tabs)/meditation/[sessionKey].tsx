import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Chip, EmptyState, ScreenContainer } from '@/components';
import { MEDITATION_TRACKS, findSession, findTrack, useMeditationCustomTrack, useMeditationLogs } from '@/modules/meditation';
import { useAppTheme } from '@/theme';

const MIN_LOGGABLE_SECONDS = 5;
const DURATION_OPTIONS_MIN = [3, 5, 10, 15, 20, 30];

export default function MeditationPlayerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { sessionKey } = useLocalSearchParams<{ sessionKey: string }>();
  const session = findSession(sessionKey);
  const { logSession } = useMeditationLogs();
  const { customTrack, setCustomTrack } = useMeditationCustomTrack();

  const [durationSeconds, setDurationSeconds] = useState(session?.durationSeconds ?? 5 * 60);
  const [trackKey, setTrackKey] = useState(session?.defaultTrackKey ?? MEDITATION_TRACKS[0].key);
  const track = trackKey === 'custom' && customTrack ? customTrack : findTrack(trackKey);
  const player = useAudioPlayer(track.audioSource);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [importing, setImporting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    player.loop = true;
    return () => {
      player.pause();
    };
  }, [player]);

  const stopPlaybackForSelection = () => {
    if (running) {
      player.pause();
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const onSelectTrack = (key: string) => {
    setTrackKey(key);
    stopPlaybackForSelection();
  };

  const onImportMusic = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await setCustomTrack(asset.uri, asset.name);
        setTrackKey('custom');
        stopPlaybackForSelection();
      }
    } finally {
      setImporting(false);
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
    const secondsToLog = completedFully ? durationSeconds : elapsed;
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
        if (next >= durationSeconds) {
          finishSession(true);
          return durationSeconds;
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
          subtitle={`You sat for ${Math.round(durationSeconds / 60)} minutes.`}
          ctaLabel="Done"
          onPressCta={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  const remaining = durationSeconds - elapsed;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  const progress = elapsed / durationSeconds;
  const allTracks = customTrack ? [...MEDITATION_TRACKS, customTrack] : MEDITATION_TRACKS;

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'] }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {session.title}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{session.description}</Text>
        </View>

        {elapsed === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
              Duration
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
              {DURATION_OPTIONS_MIN.map((minutesOption) => (
                <Chip
                  key={minutesOption}
                  label={`${minutesOption} min`}
                  selected={durationSeconds === minutesOption * 60}
                  onPress={() => setDurationSeconds(minutesOption * 60)}
                  color={theme.colors.moduleJournal}
                  mutedColor={theme.colors.moduleJournalMuted}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium, textAlign: 'center' }}>
            Music
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
            {allTracks.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={trackKey === option.key}
                onPress={() => onSelectTrack(option.key)}
                color={theme.colors.moduleJournal}
                mutedColor={theme.colors.moduleJournalMuted}
              />
            ))}
            <Pressable
              onPress={onImportMusic}
              disabled={importing}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}>
              <Ionicons name="add-circle-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>
                {importing ? 'Importing…' : 'Import music'}
              </Text>
            </Pressable>
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
