import { useCallback, useState } from 'react';

// Explicit .web import — the barrel-less extensionless path still resolves to the native
// (1-arg, db-taking) buildExportDatasets.ts for tsc's cross-file type-checking, even though
// Metro correctly bundles this 0-arg web version at runtime.
import { buildExportDatasets } from './buildExportDatasets.web';
import { exportToExcel } from './exportToExcel';
import { exportToPdf } from './exportToPdf';

/**
 * Web build of useDataExport.ts — same exported shape. buildExportDatasets.web.ts reads from the
 * webDb singleton (no db argument, matching the drop-the-leading-db-param convention used by
 * modules/sync/syncEngine.web.ts). exportToPdf.web.ts/exportToExcel.web.ts take the same
 * already-built datasets but swap expo-print/expo-sharing/expo-file-system (no browser
 * equivalent) for a Blob + <a download> trigger (Excel) and a print-dialog-driven "Save as PDF"
 * (PDF) — same function names, picked up automatically by Metro's platform resolution.
 */
export function useDataExport() {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = useCallback(async () => {
    setError(null);
    setExporting('pdf');
    try {
      const datasets = await buildExportDatasets();
      await exportToPdf(datasets);
    } catch {
      setError('Export failed — please try again.');
    } finally {
      setExporting(null);
    }
  }, []);

  const exportExcel = useCallback(async () => {
    setError(null);
    setExporting('excel');
    try {
      const datasets = await buildExportDatasets();
      await exportToExcel(datasets);
    } catch {
      setError('Export failed — please try again.');
    } finally {
      setExporting(null);
    }
  }, []);

  return { exporting, error, exportPdf, exportExcel };
}
