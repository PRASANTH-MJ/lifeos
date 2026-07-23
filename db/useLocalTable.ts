import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext, type SQLiteBindParams } from 'expo-sqlite';

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const insert = useCallback(
    async (values: Partial<T>) => {
      const keys = Object.keys(values) as (keyof T)[];
      const placeholders = keys.map(() => '?').join(', ');
      const result = await db.runAsync(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        keys.map((k) => values[k] as string | number | null)
      );
      await refresh();
      return result.lastInsertRowId;
    },
    [db, table, refresh]
  );

  const update = useCallback(
    async (id: number, values: Partial<T>) => {
      const keys = Object.keys(values) as (keyof T)[];
      const setClause = keys.map((k) => `${String(k)} = ?`).join(', ');
      await db.runAsync(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [
        ...keys.map((k) => values[k] as string | number | null),
        id,
      ]);
      await refresh();
    },
    [db, table, refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
      await refresh();
    },
    [db, table, refresh]
  );

  return { rows, loading, refresh, insert, update, remove };
}
