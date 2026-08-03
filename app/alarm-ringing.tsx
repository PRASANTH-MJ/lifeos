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

  useEffect(() => {
    player.loop = true;
    player.play();
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      player.pause();
      Vibration.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    player.pause();
    Vibration.cancel();
  };

  const onDismiss = async () => {
    stop();
    if (identifier) await cancelAlarm(identifier);
    router.back();
  };

  const onSnooze = async () => {
    stop();
    if (identifier) {
      await scheduleOneTimeAlarm({
        identifier: `${identifier}-snooze`,
        title: title || 'Alarm',
        body: body || '',
        date: new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000),
        data: { kind: 'alarm', identifier, title: title || 'Alarm', body: body || '' },
      });
    }
    router.back();
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
