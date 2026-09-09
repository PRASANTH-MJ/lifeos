import { useAudioPlayer } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, Vibration, View } from 'react-native';

import { Button } from '@/components';
import { cancelAlarm, scheduleOneTimeAlarm } from '@/notifications';
import { useAppTheme } from '@/theme';

// [wait, vibrate, pause] repeating — Vibration.vibrate's repeat option loops the whole pattern.
const VIBRATION_PATTERN = [0, 800, 400];

const SNOOZE_MINUTES = 5;

/**
 * The full-screen takeover shown when an "Alarm"-type reminder fires — launched either by the
 * notification's Android full-screen intent (app was backgrounded/killed) or by the in-app
 * routing in app/_layout.tsx (alarm fired while the app was already open). Loops a sound +
 * vibration until the user explicitly dismisses or snoozes; a placeholder track (`flashes.mp3`,
 * the same asset used in Meditation) stands in until a dedicated alarm tone is dropped in.
 */
export default function AlarmRingingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { identifier, title, body } = useLocalSearchParams<{ identifier?: string; title?: string; body?: string }>();
  const player = useAudioPlayer(require('../assets/audio/flashes.mp3'));

  // Both the explicit stop() (Dismiss/Snooze) and this effect's own cleanup call player.pause()
  // — dismissing always triggers both (stop() runs first, then leaveAlarmScreen()'s navigation
  // unmounts this screen, running the cleanup too). Calling pause() a second time on a player
  // expo-audio already considers stopped/released, or on Vibration after the OS already tore
  // down the vibration session, has been an intermittent native crash straight to
  // RootErrorBoundary — wrapped defensively here (matching notifications/alarm.ts's own
  // `safely()` pattern for the exact same class of "native module already torn down" issue).
  useEffect(() => {
    player.loop = true;
    player.play();
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      try {
        player.pause();
      } catch {
        // best-effort — see comment above
      }
      try {
        Vibration.cancel();
      } catch {
        // best-effort
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    try {
      player.pause();
    } catch {
      // best-effort — see the effect cleanup's comment above
    }
    try {
      Vibration.cancel();
    } catch {
      // best-effort
    }
  };

  // When the app was killed and this screen was launched fresh via the notification's Android
  // full-screen intent, there's no prior screen underneath it — router.back() is a no-op in that
  // case, and Android's default handling of "nothing left to go back to" on a single-Activity
  // Expo app is to finish the Activity, which looks exactly like the app closing.
  // router.canGoBack() was previously used to branch between back() and replace('/'), but it can
  // report stale/incorrect state right after a cold start via full-screen intent — a false
  // "true" here still runs back() into a dead end and finishes the Activity, which is exactly the
  // "dismiss/snooze closes the app" bug this screen exists to prevent. Always replacing to home
  // removes that ambiguity entirely: it's a valid destination whether or not there was anything
  // to go back to.
  const leaveAlarmScreen = () => {
    router.replace('/');
  };

  const onDismiss = async () => {
    stop();
    try {
      if (identifier) await cancelAlarm(identifier);
    } catch {
      // best-effort — never let a cancellation failure block actually leaving this screen
    }
    leaveAlarmScreen();
  };

  const onSnooze = async () => {
    stop();
    try {
      if (identifier) {
        await scheduleOneTimeAlarm({
          identifier: `${identifier}-snooze`,
          title: title || 'Alarm',
          body: body || '',
          date: new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000),
          data: { kind: 'alarm', identifier, title: title || 'Alarm', body: body || '' },
        });
      }
    } catch {
      // best-effort — same reasoning as onDismiss above
    }
    leaveAlarmScreen();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl, padding: theme.spacing.xl }}>
      <Text style={{ fontSize: 64 }}>⏰</Text>
      <View style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: theme.typography.size['2xl'], fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
          {title || 'Alarm'}
        </Text>
        {body ? (
          <Text style={{ color: '#fff', fontSize: theme.typography.size.base, textAlign: 'center', opacity: 0.85 }}>{body}</Text>
        ) : null}
      </View>

      <View style={{ width: '100%', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
        <Button label={`Snooze ${SNOOZE_MINUTES} min`} onPress={onSnooze} variant="secondary" />
        <Button label="Dismiss" onPress={onDismiss} />
      </View>
    </View>
  );
}
