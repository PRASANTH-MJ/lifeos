import { useNetworkState } from 'expo-network';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

/** Mounted once near the root (see app/_layout.tsx), never per-screen — useNetworkState() already
 * wraps the right primitive on every platform (native connectivity APIs on iOS/Android,
 * navigator.onLine + online/offline listeners on web via expo-network's own web module, see
 * modules/sync/useSyncEngine{,.web}.ts which already drive reconnect-sync off the same hook), so
 * there's no separate listener to wire up here. `undefined` while the very first read is in
 * flight is treated as online — a transient loading flash reading "offline" would be a worse
 * first impression than briefly not showing a banner that turns out to be needed. */
export function OfflineBanner() {
  const theme = useAppTheme();
  const network = useNetworkState();
  const isOffline = network.isConnected === false;

  if (!isOffline) return null;

  return (
    <View style={{ backgroundColor: theme.colors.warning, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md }}>
      <Text style={{ color: theme.colors.background, fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textAlign: 'center' }}>
        You're offline — changes will sync once you're back online
      </Text>
    </View>
  );
}
