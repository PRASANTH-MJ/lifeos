import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'recent-exercises';
const MAX_RECENT = 10;

export function useRecentExercises() {
  const [recentKeys, setRecentKeys] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        setRecentKeys(JSON.parse(raw));
      } catch {}
    });
  }, []);

  const recordView = useCallback((key: string) => {
    setRecentKeys((current) => {
      const next = [key, ...current.filter((k) => k !== key)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentKeys, recordView };
}
