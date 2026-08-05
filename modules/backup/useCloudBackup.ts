import { getDownloadURL, getMetadata, ref, uploadString } from 'firebase/storage';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';

import { storage } from '@/firebase/config';
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
      await uploadString(ref(storage, backupPath(user.uid)), payload, 'raw', { contentType: 'application/json' });
      await refreshLastBackupAt();
    } catch {
      setError('Backup failed — check your connection and try again.');
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
      } catch {
        setError('No backup found for this account yet.');
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
    } catch {
      setError('Restore failed — check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  }, [db, user]);

  return { backingUp, restoring, lastBackupAt, error, backupNow, restoreLatest, refreshLastBackupAt };
}
