import { httpsCallable } from 'firebase/functions';
import { useCallback, useState } from 'react';

import { functions } from '@/firebase/config';

/** Web build of useAccountDataExport.ts — same callable, opened via window.open instead of
 * Linking.openURL (no such API on web; a new tab is the browser-native equivalent of "hand the
 * URL to the OS"). See that file's doc comment for the full reasoning. */
export function useAccountDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadMyData = useCallback(async () => {
    setError(null);
    setExporting(true);
    try {
      const exportUserData = httpsCallable<Record<string, never>, { url: string }>(functions, 'exportUserData');
      const result = await exportUserData({});
      window.open(result.data.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, error, downloadMyData };
}
