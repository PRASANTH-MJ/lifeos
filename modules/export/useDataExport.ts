import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { buildExportDatasets } from './buildExportDatasets';
import { exportToExcel } from './exportToExcel';
import { exportToPdf } from './exportToPdf';

export function useDataExport() {
  const db = useSQLiteContext();
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = useCallback(async () => {
    setError(null);
    setExporting('pdf');
    try {
      const datasets = await buildExportDatasets(db);
      await exportToPdf(datasets);
    } catch {
      setError('Export failed — please try again.');
    } finally {
      setExporting(null);
    }
  }, [db]);

  const exportExcel = useCallback(async () => {
    setError(null);
    setExporting('excel');
    try {
      const datasets = await buildExportDatasets(db);
      await exportToExcel(datasets);
    } catch {
      setError('Export failed — please try again.');
    } finally {
      setExporting(null);
    }
  }, [db]);

  return { exporting, error, exportPdf, exportExcel };
}
