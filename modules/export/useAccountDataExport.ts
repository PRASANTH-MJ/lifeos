import { httpsCallable } from 'firebase/functions';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { functions } from '@/firebase/config';

/** "Download my data" — the account-wide JSON export, distinct from useDataExport's local
 * PDF/Excel export of just this device's SQLite tables. The server (exportUserData, functions/
 * index.js) assembles every collection this account's data actually lives in — including ones
 * firestore.rules never lets the client read directly (orders, notifications) — and hands back a
 * short-lived signed Storage URL rather than the JSON itself, since a long-lived account's synced
 * history can run well past what's comfortable to return inline from a callable.
 *
 * Opens the signed URL in the device browser rather than downloading it into app storage first —
 * same "hand off a URL, let the OS handle it" approach as the YouTube/mailto links elsewhere in
 * this app (see app/help.tsx etc.); a signed HTTPS URL has no local file for expo-sharing's share
 * sheet to attach. */
export function useAccountDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadMyData = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      const exportUserData = httpsCallable<Record<string, never>, { url: string }>(functions, 'exportUserData');
      const result = await exportUserData({});
      await Linking.openURL(result.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, error, downloadMyData };
}
