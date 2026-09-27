import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import type { AppSettings, TimeFormat } from './types';

type Row = {
  time_format: TimeFormat;
  scoreboard_weekly_reminder?: number;
  last_weekly_recap_shown_at?: string | null;
  last_seen_changelog_version?: string | null;
  default_currency?: string | null;
};

/**
 * Web build of useSettings.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: a write from any tab (or the sync engine's merge) flows into
 * every mounted useSettings() instance automatically, so no manual refresh() is needed.
 */
export function useSettings() {
  const row = useLiveQuery(() => webDb.app_settings.get(1) as Promise<Row | undefined>, []);
  const loading = row === undefined;
  const settings: AppSettings = {
    timeFormat: row?.time_format ?? '24h',
    scoreboardWeeklyReminder: row?.scoreboard_weekly_reminder === 1,
    lastWeeklyRecapShownAt: row?.last_weekly_recap_shown_at ?? null,
    lastSeenChangelogVersion: row?.last_seen_changelog_version ?? null,
    defaultCurrency: row?.default_currency ?? null,
  };

  const setTimeFormat = useCallback(async (timeFormat: TimeFormat) => {
    await webDb.app_settings.update(1, { time_format: timeFormat, updated_at: new Date().toISOString() });
    await pushLocalRow('app_settings', 1);
  }, []);

  const setScoreboardWeeklyReminder = useCallback(async (enabled: boolean) => {
    await webDb.app_settings.update(1, { scoreboard_weekly_reminder: enabled ? 1 : 0, updated_at: new Date().toISOString() });
    await pushLocalRow('app_settings', 1);
  }, []);

  const setLastWeeklyRecapShownAt = useCallback(async (shownAt: string) => {
    await webDb.app_settings.update(1, { last_weekly_recap_shown_at: shownAt, updated_at: new Date().toISOString() });
    await pushLocalRow('app_settings', 1);
  }, []);

  const setLastSeenChangelogVersion = useCallback(async (version: string) => {
    await webDb.app_settings.update(1, { last_seen_changelog_version: version, updated_at: new Date().toISOString() });
    await pushLocalRow('app_settings', 1);
  }, []);

  const setDefaultCurrency = useCallback(async (currency: string) => {
    await webDb.app_settings.update(1, { default_currency: currency, updated_at: new Date().toISOString() });
    await pushLocalRow('app_settings', 1);
  }, []);

  return {
    settings,
    loading,
    setTimeFormat,
    setScoreboardWeeklyReminder,
    setLastWeeklyRecapShownAt,
    setLastSeenChangelogVersion,
    setDefaultCurrency,
  };
}
