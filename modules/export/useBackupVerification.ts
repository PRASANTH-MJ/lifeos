import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { buildExportDatasets } from './buildExportDatasets';
import { verifyBackupExport, type BackupVerificationResult } from './verifyBackupExport';

/** "Verify my backup" — read-only: gathers this device's local counts the same way "Export
 * PDF"/"Export Excel" already do (buildExportDatasets), then checks them against the same
 * "Download my data" export path (see verifyBackupExport.ts) rather than restoring or overwriting
 * anything live. */
export function useBackupVerification() {
  const db = useSQLiteContext();
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<BackupVerificationResult | null>(null);

  const verifyBackup = useCallback(async () => {
    setVerifying(true);
    setResult(null);
    try {
      const localDatasets = await buildExportDatasets(db);
      setResult(await verifyBackupExport(localDatasets));
    } catch (err) {
      setResult({ ok: false, summary: `⚠ Couldn't verify: ${err instanceof Error ? err.message : 'please try again.'}` });
    } finally {
      setVerifying(false);
    }
  }, [db]);

  return { verifying, result, verifyBackup };
}
