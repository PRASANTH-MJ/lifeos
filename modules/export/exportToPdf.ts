import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { ExportDatasets } from './buildExportDatasets';

function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tableSection(title: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return `<h2>${escapeHtml(title)}</h2><p style="color:#888;">No data.</p>`;
  }
  const columns = Object.keys(rows[0]);
  const headerRow = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`)
    .join('');
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

export async function exportToPdf(datasets: ExportDatasets): Promise<string> {
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Roboto, sans-serif; padding: 24px; color: #222; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
          th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; word-break: break-word; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Flowsy Data Export</h1>
        <p style="color:#666; font-size:12px;">${new Date().toLocaleDateString()}</p>
        ${Object.entries(datasets)
          .map(([name, rows]) => tableSection(name, rows))
          .join('')}
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export data' });
  }
  return uri;
}
