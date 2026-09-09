import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'meditation-ambient-sound-override';

/** The user's last explicitly-picked ambient track, independent of any one session's own bundled
 * default (see MEDITATION_SESSIONS/CHAKRAS' defaultTrackKey/audioTrackKey) — set via a session
 * screen's "Change sound" picker and reused as the starting track for every session, guided or
 * chakra, until picked again. A plain AsyncStorage preference, same pattern as
 * modules/workout/useRecentExercises.ts, rather than a synced app_settings column: this is a
 * device-local listening preference, not data that needs to follow the account across devices. */
export function useAmbientSoundOverride() {
  const [overrideKey, setOverrideKeyState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setOverrideKeyState(value);
      setLoading(false);
    });
  }, []);

  const setOverrideKey = useCallback((key: string) => {
    setOverrideKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key);
  }, []);

  return { overrideKey, loading, setOverrideKey };
}
