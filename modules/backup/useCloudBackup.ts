import { getDownloadURL, getMetadata, ref } from 'firebase/storage';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';

import { storage, storageBucketName } from '@/firebase/config';
import { useAuth } from '@/modules/auth';
import { SYNC_TABLES } from '@/modules/sync/syncSchema';

// Reuses the sync engine's table registry purely for its table list + dependency order (parents
// before children, safe for a wipe-and-reinsert restore) — nothing here depends on sync actually
// running, or on the sync_id-based foreign-key remapping that registry exists for. Deliberately
// excludes user_profile, same as sync: its PIN is device-specific and shouldn't restore onto a
// different device than the one that set it.
const BACKUP_TABLES = SYNC_TABLES.map((config) => config.table);

function backupPath(uid: string): string {
  return `backups/${uid}/latest.json`;
}

function bindValue(value: unknown): SQLiteBindValue {
  return value as SQLiteBindValue;
}

/** The Firebase JS SDK's uploadString()/uploadBytes() build a Blob from the payload internally,
 * which throws "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported" on
 * React Native 0.74+ — an unresolved SDK/RN incompatibility (firebase/firebase-js-sdk#8648), not
 * something fixable by switching upload format. Uploading via the plain Storage REST API with
 * fetch() (a string body, no Blob involved) sidesteps it entirely. Downloads don't hit this bug —
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

export function useCloudBackup() {
  const db = useSQLiteContext();
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
        tables[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
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
  }, [db, user, refreshLastBackupAt]);

  /** Wipes and re-inserts every backed-up table, preserving original row ids so foreign keys
   * (e.g. habit_logs.habit_id) still point at the right rows — foreign_keys is switched off for
   * the duration so table order doesn't matter for constraint checking (BACKUP_TABLES' order is
   * still followed for the delete/insert itself, just not load-bearing for FK validity). */
  const restoreLatest = useCallback(async () => {
    if (!user) return;
    setError(null);
    setRestoring(true);
    try {
      let backup: { tables?: Record<string, Record<string, unknown>[]> };
      try {
        const url = await getDownloadURL(ref(storage, backupPath(user.uid)));
        const response = await fetch(url);
        backup = await response.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // storage/object-not-found is the one case that really does mean "no backup yet" —
        // anything else (unauthorized, network, etc.) is a different problem and saying so
        // would be actively misleading.
        setError(message.includes('object-not-found') ? 'No backup found for this account yet.' : `Restore failed: ${message}`);
        return;
      }

      await db.execAsync('PRAGMA foreign_keys = OFF');
      try {
        for (const table of BACKUP_TABLES) {
          const rows = backup.tables?.[table] ?? [];
          await db.runAsync(`DELETE FROM ${table}`);
          for (const row of rows) {
            const columns = Object.keys(row);
            if (columns.length === 0) continue;
            const placeholders = columns.map(() => '?').join(', ');
            await db.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, columns.map((c) => bindValue(row[c])));
          }
        }
      } finally {
        await db.execAsync('PRAGMA foreign_keys = ON');
      }
    } catch (err) {
      setError(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoring(false);
    }
  }, [db, user]);

  return { backingUp, restoring, lastBackupAt, error, backupNow, restoreLatest, refreshLastBackupAt };
}
