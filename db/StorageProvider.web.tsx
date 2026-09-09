import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { migrateOpfsToIndexedDbIfNeeded } from './migrateOpfsToIndexedDb';

/**
 * Web build of StorageProvider — runs the one-time OPFS-SQLite -> IndexedDB carry-over (see
 * migrateOpfsToIndexedDb.ts) before rendering children, so every hook downstream can assume
 * webDb is fully populated the moment the app is visible. A brand-new web user (empty legacy
 * OPFS db) resolves this near-instantly since there's nothing to copy.
 */
export function StorageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    migrateOpfsToIndexedDbIfNeeded()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))));
  }, []);

  if (error) throw error; // Caught by RootErrorBoundary, same as any other startup failure.
  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}

function LoadingScreen() {
  const scheme = useColorScheme();
  const backgroundColor = scheme === 'dark' ? '#0B0D12' : '#F9FAFB';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor }}>
      <ActivityIndicator />
    </View>
  );
}
