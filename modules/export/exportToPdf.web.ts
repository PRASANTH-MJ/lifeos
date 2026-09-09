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

/** Web build of exportToPdf.ts — expo-print/expo-sharing have no browser equivalent. Opens the
 * same styled HTML in a new tab and triggers the browser's native print dialog, where "Save as
 * PDF" is a standard destination on every major browser — the same end result (a PDF of the
 * data) without pulling in a PDF-generation library. */
export async function exportToPdf(datasets: ExportDatasets): Promise<string> {
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Flowsy Data Export</title>
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
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Could not open export window — check your browser’s popup blocker.');
  }
  // Revoke once the new tab has had a chance to load the blob URL rather than immediately, or
  // the navigation itself can race the revocation.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return url;
}
