import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import type { ExportDatasets } from './buildExportDatasets';

/** Sheet names in Excel are capped at 31 characters and can't contain some punctuation —
 * dataset names here are already short and clean, but this stays defensive if that changes. */
function sheetName(name: string): string {
  return name.slice(0, 31);
}

export async function exportToExcel(datasets: ExportDatasets): Promise<string> {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(datasets)) {
    const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ note: 'No data' }]);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName(name));
  }
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;

  const file = new File(Paths.cache, `flowsy-export-${Date.now()}.xlsx`);
  // File#write is synchronous, unlike almost everything else in this codebase's file/network I/O.
  file.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export data',
    });
  }
  return file.uri;
}
