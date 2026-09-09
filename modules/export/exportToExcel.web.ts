import * as XLSX from 'xlsx';

import type { ExportDatasets } from './buildExportDatasets';

function sheetName(name: string): string {
  return name.slice(0, 31);
}

/** Web build of exportToExcel.ts — expo-file-system/expo-sharing have no browser equivalent, so
 * this triggers a standard browser download instead of a native share sheet: build the same xlsx
 * workbook, wrap it in a Blob, and click a temporary <a download> element. */
export async function exportToExcel(datasets: ExportDatasets): Promise<string> {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(datasets)) {
    const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ note: 'No data' }]);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName(name));
  }
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const filename = `flowsy-export-${Date.now()}.xlsx`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
