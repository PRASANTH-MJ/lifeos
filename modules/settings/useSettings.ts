import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { pushLocalRow } from '@/modules/sync';
import type { AppSettings, TimeFormat } from './types';

export function useSettings() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<{
      time_format: TimeFormat;
      scoreboard_weekly_reminder: number;
      last_weekly_recap_shown_at: string | null;
      last_seen_changelog_version: string | null;
    }>(
      'SELECT time_format, scoreboard_weekly_reminder, last_weekly_recap_shown_at, last_seen_changelog_version FROM app_settings WHERE id = 1'
    );
    setSettings({
      timeFormat: row?.time_format ?? '24h',
      scoreboardWeeklyReminder: row?.scoreboard_weekly_reminder === 1,
      lastWeeklyRecapShownAt: row?.last_weekly_recap_shown_at ?? null,
      lastSeenChangelogVersion: row?.last_seen_changelog_version ?? null,
    });
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
      await pushLocalRow(db, 'app_settings', 1);
      await refresh();
    },
    [db, refresh]
  );

  const setScoreboardWeeklyReminder = useCallback(
    async (enabled: boolean) => {
      await db.runAsync('UPDATE app_settings SET scoreboard_weekly_reminder = ?, updated_at = ? WHERE id = 1', [
        enabled ? 1 : 0,
        new Date().toISOString(),
      ]);
      await pushLocalRow(db, 'app_settings', 1);
      await refresh();
    },
    [db, refresh]
  );

  const setLastWeeklyRecapShownAt = useCallback(
    async (shownAt: string) => {
      await db.runAsync('UPDATE app_settings SET last_weekly_recap_shown_at = ?, updated_at = ? WHERE id = 1', [
        shownAt,
        new Date().toISOString(),
      ]);
      await pushLocalRow(db, 'app_settings', 1);
      await refresh();
    },
    [db, refresh]
  );

  const setLastSeenChangelogVersion = useCallback(
    async (version: string) => {
      await db.runAsync('UPDATE app_settings SET last_seen_changelog_version = ?, updated_at = ? WHERE id = 1', [
        version,
        new Date().toISOString(),
      ]);
      await pushLocalRow(db, 'app_settings', 1);
      await refresh();
    },
    [db, refresh]
  );

  return {
    settings,
    loading,
    setTimeFormat,
    setScoreboardWeeklyReminder,
    setLastWeeklyRecapShownAt,
    setLastSeenChangelogVersion,
  };
}
