import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BreathingOrb, Card, Chip, CountdownDisplay, EmptyState, IconBadge, PostToFeedPrompt, ScreenContainer, type ShareCardData } from '@/components';
import { MEDITATION_TRACKS, findSession, findTrack, useAmbientSoundOverride, useCountdownSession, useMeditationCustomTrack, useMeditationLogs } from '@/modules/meditation';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useActiveTimerNotification } from '@/notifications/useActiveTimerNotification';
import { useAppTheme } from '@/theme';

const MIN_LOGGABLE_SECONDS = 5;
const DURATION_OPTIONS_MIN = [3, 5, 10, 15, 20, 30];

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MeditationPlayerScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { sessionKey } = useLocalSearchParams<{ sessionKey: string }>();
  const session = findSession(sessionKey);
  const { logSession } = useMeditationLogs();
  const { customTrack, setCustomTrack } = useMeditationCustomTrack();
  const { overrideKey, loading: loadingOverride, setOverrideKey } = useAmbientSoundOverride();
  const streak = useMindfulnessStreak();

  const [durationSeconds, setDurationSeconds] = useState(session?.durationSeconds ?? 5 * 60);
  const [trackKey, setTrackKey] = useState(session?.defaultTrackKey ?? MEDITATION_TRACKS[0].key);
  // Applies the user's last-picked "Change sound" override in place of this session's own bundled
  // default — once, the moment useAmbientSoundOverride's AsyncStorage read resolves, so it can't
  // fire again later and yank the track out from under someone who's already picked one this
  // session (including picking back to the session's own default).
  const appliedOverrideRef = useRef(false);
  useEffect(() => {
    if (loadingOverride || appliedOverrideRef.current) return;
    appliedOverrideRef.current = true;
    if (overrideKey) setTrackKey(overrideKey);
  }, [loadingOverride, overrideKey]);
  const track = trackKey === 'custom' && customTrack ? customTrack : findTrack(trackKey);
  const player = useAudioPlayer(track.audioSource);
  const { elapsed, running, start, pause, completedAt } = useCountdownSession(durationSeconds);
  const [finished, setFinished] = useState(false);
  const [importing, setImporting] = useState(false);

  useActiveTimerNotification({
    enabled: running,
    title: session?.title ?? 'Meditation',
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
    if (secondsToLog >= MIN_LOGGABLE_SECONDS && session) {
      await logSession(session.key, secondsToLog);
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

  const stopPlaybackForSelection = () => {
    if (running) {
      try {
        player.pause();
      } catch {}
      pause();
    }
  };

  const onSelectTrack = (key: string) => {
    setTrackKey(key);
    // Only bundled tracks become the remembered override — a one-off imported file's device URI
    // wouldn't resolve on a later visit (or another device), so 'custom' stays a per-session pick.
    if (key !== 'custom') setOverrideKey(key);
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

  if (!session) {
    return (
      <ScreenContainer>
        <EmptyState icon="alert-circle-outline" title="Session not found" />
      </ScreenContainer>
    );
  }

  const meditationShareCard: ShareCardData = {
    eyebrow: session.title,
    value: String(Math.round(durationSeconds / 60)),
    valueLabel: 'min meditated',
    detail: `${streak} day streak${streak === 1 ? '' : 's'}`,
    icon: session.icon,
    accentColor: theme.colors.moduleJournal,
  };

  if (finished) {
    return (
      <ScreenContainer>
        {/* Not flex:1/justifyContent:'center' — see live-session.tsx's identical fix: centering
            made the screen read as "finished" before scrolling down to "Post to Feed". */}
        <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
          <EmptyState
            icon="checkmark-circle"
            title="Session complete"
            subtitle={`You sat for ${Math.round(durationSeconds / 60)} minutes.`}
          />
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
  const allTracks = customTrack ? [...MEDITATION_TRACKS, customTrack] : MEDITATION_TRACKS;

  return (
    <ScreenContainer scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing['2xl'] }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <IconBadge name={session.icon} color={theme.colors.moduleJournal} size="lg" />
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.bold }}>
            {session.title}
          </Text>
          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{session.description}</Text>
        </View>

        <Card tier="panel" style={{ gap: theme.spacing.lg }}>
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
        </Card>

        <CountdownDisplay remainingSeconds={remaining} progress={progress} color={theme.colors.moduleJournal} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl }}>
          <BreathingOrb active={running} color={theme.colors.moduleJournal} size={100}>
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
