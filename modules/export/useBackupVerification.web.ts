import { useCallback, useState } from 'react';

// Explicit .web import — see useDataExport.web.ts's doc comment for why the extensionless path
// still resolves to the native (1-arg, db-taking) buildExportDatasets.ts for tsc.
import { buildExportDatasets } from './buildExportDatasets.web';
import { verifyBackupExport, type BackupVerificationResult } from './verifyBackupExport';

/** Web build of useBackupVerification.ts — same exported shape, reads local counts via
 * buildExportDatasets.web's webDb-backed gathering instead of SQLite. */
export function useBackupVerification() {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<BackupVerificationResult | null>(null);

  const verifyBackup = useCallback(async () => {
    setVerifying(true);
    setResult(null);
    try {
      const localDatasets = await buildExportDatasets();
      setResult(await verifyBackupExport(localDatasets));
    } catch (err) {
      setResult({ ok: false, summary: `⚠ Couldn't verify: ${err instanceof Error ? err.message : 'please try again.'}` });
    } finally {
      setVerifying(false);
    }
  }, []);

  return { verifying, result, verifyBackup };
}
