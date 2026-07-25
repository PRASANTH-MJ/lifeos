import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { MeditationTrack } from './types';

type CustomTrackRow = { uri: string; name: string };

/** The one user-imported audio file (from the device's own file picker), if set. */
export function useMeditationCustomTrack() {
  const db = useSQLiteContext();
  const [customTrack, setCustomTrackState] = useState<MeditationTrack | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<CustomTrackRow>('SELECT uri, name FROM meditation_custom_track WHERE id = 1');
    setCustomTrackState(row ? { key: 'custom', label: row.name, audioSource: row.uri } : null);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setCustomTrack = useCallback(
    async (uri: string, name: string) => {
      await db.runAsync(
        `INSERT INTO meditation_custom_track (id, uri, name, created_at) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET uri = excluded.uri, name = excluded.name`,
        [uri, name, new Date().toISOString()]
      );
      await refresh();
    },
    [db, refresh]
  );

  return { customTrack, loading, setCustomTrack };
}
