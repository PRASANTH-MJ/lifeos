import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { AppSettings, TimeFormat } from './types';

export function useSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<{ time_format: TimeFormat }>(
      'SELECT time_format FROM app_settings WHERE id = 1'
    );
    setSettings({ timeFormat: row?.time_format ?? '24h' });
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setTimeFormat = useCallback(
    async (timeFormat: TimeFormat) => {
      await db.runAsync('UPDATE app_settings SET time_format = ?, updated_at = ? WHERE id = 1', [
        timeFormat,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, refresh]
  );

  return { settings, loading, setTimeFormat };
}
