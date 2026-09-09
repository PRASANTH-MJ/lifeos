import { httpsCallable } from 'firebase/functions';

import { functions } from '@/firebase/config';
import type { ExportDatasets } from './buildExportDatasets';

export type BackupVerificationResult = { ok: boolean; summary: string };

/** The core tables a missing/empty backup is most likely to actually matter for — checked against
 * `localDatasets` (the exact same buildExportDatasets output "Export PDF"/"Export Excel" already
 * gather) purely to know whether this device *has* data in that table right now; the counts shown
 * in the summary always come from the export itself, since that's what's actually verified. */
const CORE_TABLES: { exportKey: string; localKey: keyof ExportDatasets; label: string }[] = [
  { exportKey: 'habits', localKey: 'Habits', label: 'habits' },
  { exportKey: 'tasks', localKey: 'Tasks', label: 'tasks' },
  { exportKey: 'finance_transactions', localKey: 'Finance Transactions', label: 'transactions' },
];

/** Shared by useBackupVerification.ts/.web.ts — the only thing that differs between them is how
 * `localDatasets` was gathered (SQLite vs Dexie), already handled by buildExportDatasets'
 * platform split. Calls the exact same `exportUserData` callable "Download my data" does (see
 * useAccountDataExport.ts) rather than re-assembling the account export client-side — this stays
 * read-only: it only fetches and inspects the signed URL's JSON, never writes or restores
 * anything into the live app. */
export async function verifyBackupExport(localDatasets: ExportDatasets): Promise<BackupVerificationResult> {
  const exportUserData = httpsCallable<Record<string, never>, { url: string }>(functions, 'exportUserData');
  const { data } = await exportUserData({});

  const response = await fetch(data.url);
  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, summary: "⚠ Couldn't verify: the backup file wasn't valid JSON." };
  }

  const records = (parsed as { records?: unknown } | null)?.records;
  if (!records || typeof records !== 'object') {
    return { ok: false, summary: "⚠ Couldn't verify: the backup is missing its records." };
  }

  const findings = CORE_TABLES.map(({ exportKey, localKey, label }) => {
    const localCount = localDatasets[localKey]?.length ?? 0;
    const exportValue = (records as Record<string, unknown>)[exportKey];
    const exportCount = Array.isArray(exportValue) ? exportValue.length : 0;
    return { label, localCount, exportCount };
  });

  const missing = findings.filter((f) => f.localCount > 0 && f.exportCount === 0);
  if (missing.length > 0) {
    return {
      ok: false,
      summary: `⚠ Couldn't verify: your backup doesn't yet include the ${missing.map((f) => f.label).join(', ')} on this device — try Sync now, then verify again.`,
    };
  }

  const present = findings.filter((f) => f.exportCount > 0);
  const countsText = present.length > 0 ? present.map((f) => `${f.exportCount} ${f.label}`).join(', ') : 'no data yet';
  return { ok: true, summary: `✓ Backup looks complete — ${countsText}.` };
}
