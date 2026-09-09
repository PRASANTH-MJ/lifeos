import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext, type SQLiteBindParams } from 'expo-sqlite';

import { onLocalWrite, pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

type Row = { id: number };

export type QueryOptions = {
  where?: string;
  params?: SQLiteBindParams;
  orderBy?: string;
};

/**
 * Generic CRUD-over-SQLite hook. One instance = one live query against a
 * single table; every module hook (useHabits, useTasks, useJournal, ...)
 * composes this instead of hand-rolling its own query/refresh plumbing.
 *
 * Every table this hook is used against is synced to Firestore (see modules/sync/) — insert/
 * update stamp `sync_id`/`updated_at` if the caller didn't already provide them, then push the
 * row's current state; remove records a tombstone before deleting so a remote listener can tell
 * "deleted" apart from "never existed".
 */
export function useLocalTable<T extends Row>(table: string, options: QueryOptions = {}) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const { where, params = [], orderBy } = options;
  const paramsKey = JSON.stringify(params);

  const refresh = useCallback(async () => {
    setLoading(true);
    const clauses = [`SELECT * FROM ${table}`];
    if (where) clauses.push(`WHERE ${where}`);
    if (orderBy) clauses.push(`ORDER BY ${orderBy}`);
    const result = await db.getAllAsync<T>(clauses.join(' '), params);
    setRows(result);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, table, where, orderBy, paramsKey]);

  // Refetch on every focus (not just mount) — tab screens stay mounted when
  // you navigate away and back, so a plain mount-only effect would leave a
  // list showing stale data after adding/editing a record elsewhere.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // A write made through a DIFFERENT instance of this same hook (e.g. usePublicProfileStatsSync's
  // own independent useLocalTable('habits', ...) call, mounted once at the root layout and never
  // "focused" again by navigation) wouldn't otherwise be seen by this instance until its own next
  // focus — see onLocalWrite's doc comment.
  useEffect(() => {
    return onLocalWrite((changedTable) => {
      if (changedTable === table) refresh();
    });
  }, [table, refresh]);

  const insert = useCallback(
    async (values: Partial<T>) => {
      const withSync = {
        ...values,
        sync_id: (values as Record<string, unknown>).sync_id ?? Crypto.randomUUID(),
        updated_at: (values as Record<string, unknown>).updated_at ?? new Date().toISOString(),
      };
      const keys = Object.keys(withSync) as (keyof typeof withSync)[];
      const placeholders = keys.map(() => '?').join(', ');
      const result = await db.runAsync(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        keys.map((k) => withSync[k] as string | number | null)
      );
      await pushLocalRow(db, table, result.lastInsertRowId);
      await refresh();
      return result.lastInsertRowId;
    },
    [db, table, refresh]
  );

  const update = useCallback(
    async (id: number, values: Partial<T>) => {
      const withSync = { ...values, updated_at: (values as Record<string, unknown>).updated_at ?? new Date().toISOString() };
      const keys = Object.keys(withSync) as (keyof typeof withSync)[];
      const setClause = keys.map((k) => `${String(k)} = ?`).join(', ');
      await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
        ...keys.map((k) => withSync[k] as string | number | null),
        id,
      ]);
      await pushLocalRow(db, table, id);
      await refresh();
    },
    [db, table, refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await recordDeleteBeforeRemoving(db, table, id);
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
      await refresh();
    },
    [db, table, refresh]
  );

  return { rows, loading, refresh, insert, update, remove };
}
