import { getBytes, getMetadata, ref } from 'firebase/storage';
import { useCallback, useState } from 'react';

import { webDb } from '@/db/webDb';
import { storage, storageBucketName } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { SYNC_TABLES } from '@/modules/sync/syncSchema';

// Reuses the sync engine's table registry purely for its table list + dependency order (parents
// before children — not load-bearing here since IndexedDB has no FK constraint checking, but
// kept identical to the native file so the two stay easy to diff) — nothing here depends on sync
// actually running. Deliberately excludes user_profile, same as sync: its PIN is device-specific
// and shouldn't restore onto a different device than the one that set it.
const BACKUP_TABLES = SYNC_TABLES.map((config) => config.table);

function backupPath(uid: string): string {
  return `backups/${uid}/latest.json`;
}

/** The Firebase JS SDK's uploadString()/uploadBytes() build a Blob from the payload internally,
 * which throws "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported" on
 * React Native 0.74+ — an unresolved SDK/RN incompatibility (firebase/firebase-js-sdk#8648), not
 * something fixable by switching upload format. That bug is RN-specific and doesn't apply on
 * web, but this helper (and the plain-fetch upload it does) is kept identical to the native file
 * for parity — a normal fetch() upload works fine here too. Downloads don't hit this bug —
 * getDownloadURL/getMetadata below are left on the SDK as before. */
async function uploadBackupJson(idToken: string, uid: string, payload: string): Promise<void> {
  const name = encodeURIComponent(backupPath(uid));
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${storageBucketName}/o?uploadType=media&name=${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: payload,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Upload failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
}

/**
 * Web build of useCloudBackup.ts — same exported shape. SQLite's db.getAllAsync/runAsync/
 * execAsync calls become webDb.table(name) Dexie calls; IndexedDB has no FK constraints, so the
 * native version's `PRAGMA foreign_keys = OFF/ON` bracketing has no equivalent (and isn't
 * needed) here — the wipe-and-reinsert per table runs inside a single Dexie 'rw' transaction
 * spanning every backed-up table instead, so a failure partway through rolls the whole restore
 * back rather than leaving some tables wiped and others not.
 */
export function useCloudBackup() {
  const { user } = useAuth();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshLastBackupAt = useCallback(async () => {
    if (!user) return;
    try {
      const metadata = await getMetadata(ref(storage, backupPath(user.uid)));
      setLastBackupAt(metadata.updated ?? metadata.timeCreated ?? null);
    } catch {
      setLastBackupAt(null);
    }
  }, [user]);

  const backupNow = useCallback(async () => {
    if (!user) return;
    setError(null);
    setBackingUp(true);
    try {
      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const table of BACKUP_TABLES) {
        tables[table] = await webDb.table(table).toArray();
      }
      const payload = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables });
      const idToken = await user.getIdToken();
      await uploadBackupJson(idToken, user.uid, payload);
      await refreshLastBackupAt();
    } catch (err) {
      // Surface Firebase's own message (e.g. "storage/unauthorized") instead of a generic
      // string — a silent catch-all here would hide exactly the detail needed to tell a rules
      // problem apart from a network hiccup apart from an API-key restriction.
      setError(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackingUp(false);
    }
  }, [user, refreshLastBackupAt]);

  /** Wipes and re-inserts every backed-up table, preserving original row ids so foreign keys
   * (e.g. habit_logs.habit_id) still point at the right rows. Dexie's '++id' auto-increment
   * primary keys still accept an explicit id on add()/bulkAdd() (only assigning a fresh one when
   * the field is omitted/undefined), so restoring with the backed-up ids works the same way the
   * native version's explicit INSERT (id, ...) VALUES (...) did. */
  const restoreLatest = useCallback(async () => {
    if (!user) return;
    setError(null);
    setRestoring(true);
    try {
      let backup: { tables?: Record<string, Record<string, unknown>[]> };
      try {
        // getBytes() (not getDownloadURL() + a raw fetch()) — a plain cross-origin fetch to a
        // Storage download URL throws a generic "Failed to fetch" on web (a CORS/network-layer
        // TypeError with no useful detail) unless the bucket has an explicit CORS policy applied,
        // which nothing in this repo configures. Reading the bytes through the SDK avoids that
        // browser-fetch path entirely.
        const bytes = await getBytes(ref(storage, backupPath(user.uid)));
        backup = JSON.parse(new TextDecoder().decode(bytes));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // storage/object-not-found is the one case that really does mean "no backup yet" —
        // anything else (unauthorized, network, etc.) is a different problem and saying so
        // would be actively misleading.
        setError(message.includes('object-not-found') ? 'No backup found for this account yet.' : `Restore failed: ${message}`);
        return;
      }

      await webDb.transaction('rw', BACKUP_TABLES.map((table) => webDb.table(table)), async () => {
        for (const table of BACKUP_TABLES) {
          const rows = backup.tables?.[table] ?? [];
          const dexieTable = webDb.table(table);
          await dexieTable.clear();
          const rowsToInsert = rows.filter((row) => Object.keys(row).length > 0);
          if (rowsToInsert.length > 0) {
            await dexieTable.bulkAdd(rowsToInsert);
          }
        }
      });
    } catch (err) {
      setError(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoring(false);
    }
  }, [user]);

  return { backingUp, restoring, lastBackupAt, error, backupNow, restoreLatest, refreshLastBackupAt };
}
