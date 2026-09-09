import { useRouter } from 'expo-router';

import { Button } from '@/components';
import { useAppTheme } from '@/theme';
import { Text, View } from 'react-native';

/** Web build of alarm-ringing.tsx — alarms are a native background-notification concept (Android
 * full-screen intents, notifee, expo-audio looping playback) with no web equivalent, so this
 * route has nothing real to do on web. The native screen has no platform guard of its own and
 * unconditionally calls useAudioPlayer/Vibration.vibrate on mount, which previously crashed
 * straight to RootErrorBoundary's "Something went wrong" screen if this URL was ever reached on
 * web (e.g. a stray deep link) — this twin keeps every native-only call out of the web bundle
 * entirely, same reasoning as record.web.tsx for GPS-only screens. */
export default function AlarmRingingWebScreen() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl }}>
      <Text style={{ fontSize: 48 }}>⏰</Text>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold, textAlign: 'center' }}>
        Alarms only ring on the mobile app
      </Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, textAlign: 'center', maxWidth: 320 }}>
        This link only does something on your phone. On web there's nothing to dismiss or snooze.
      </Text>
      <Button label="Go home" onPress={() => router.replace('/')} />
    </View>
  );
}
