import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { MeditationTrack } from './types';

type CustomTrackRow = { uri: string; name: string };

/**
 * Web build of useMeditationCustomTrack.ts — same exported shape. Reactive via Dexie's
 * useLiveQuery instead of expo-router's useFocusEffect: a write from any tab (or the sync
 * engine's merge) flows into every mounted instance automatically.
 */
const PENDING = Symbol('pending');

export function useMeditationCustomTrack() {
  // meditation_custom_track has no default seed row even natively (it's genuinely optional —
  // only created once a user sets one), so Dexie's useLiveQuery resolving to `undefined` is a
  // real, valid "no custom track set" state, not just "still loading". A distinct third-argument
  // sentinel lets the two be told apart, unlike a bare `row === undefined` check, which would
  // otherwise spin forever for the common case of a user who's never set a custom track.
  const result = useLiveQuery(
    () => webDb.meditation_custom_track.get(1) as Promise<CustomTrackRow | undefined>,
    [],
    PENDING as unknown as CustomTrackRow | undefined
  );
  const loading = (result as unknown) === PENDING;
  const row = loading ? undefined : (result as CustomTrackRow | undefined);
  const customTrack: MeditationTrack | null = row ? { key: 'custom', label: row.name, audioSource: row.uri } : null;

  const setCustomTrack = useCallback(async (uri: string, name: string) => {
    const now = new Date().toISOString();
    const existing = await webDb.meditation_custom_track.get(1);
    if (existing) {
      // Mirrors the native ON CONFLICT DO UPDATE clause: uri/name/updated_at are overwritten,
      // sync_id is kept if already set (COALESCE(sync_id, excluded.sync_id)).
      await webDb.meditation_custom_track.update(1, {
        uri,
        name,
        sync_id: (existing as Record<string, unknown>).sync_id ?? Crypto.randomUUID(),
        updated_at: now,
      });
    } else {
      await webDb.meditation_custom_track.put({
        id: 1,
        uri,
        name,
        created_at: now,
        sync_id: Crypto.randomUUID(),
        updated_at: now,
      });
    }
    await pushLocalRow('meditation_custom_track', 1);
  }, []);

  return { customTrack, loading, setCustomTrack };
}
