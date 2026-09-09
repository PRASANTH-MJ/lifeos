import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

import type { TaskLabel } from './types';

export function useTaskLabels() {
  const db = useSQLiteContext();
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ id: number; name: string; color: string }>('SELECT * FROM task_labels ORDER BY name ASC');
      setLabels(rows.map((r) => ({ id: String(r.id), name: r.name, color: r.color })));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addLabel = useCallback(
    async (name: string, color = '#8E8E93') => {
      const result = await db.runAsync('INSERT INTO task_labels (name, color, updated_at, sync_id) VALUES (?, ?, ?, ?)', [
        name,
        color,
        new Date().toISOString(),
        Crypto.randomUUID(),
      ]);
      await pushLocalRow(db, 'task_labels', result.lastInsertRowId);
      await refresh();
      return String(result.lastInsertRowId);
    },
    [db, refresh]
  );

  const editLabel = useCallback(
    async (id: string, name: string, color: string) => {
      await db.runAsync('UPDATE task_labels SET name = ?, color = ?, updated_at = ? WHERE id = ?', [
        name,
        color,
        new Date().toISOString(),
        Number(id),
      ]);
      await pushLocalRow(db, 'task_labels', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const removeLabel = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving(db, 'task_labels', Number(id));
      await db.runAsync('DELETE FROM task_labels WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { labels, loading, addLabel, editLabel, removeLabel };
}

/** Labels attached to one task, plus a setter that replaces the full set in one go
 * (delete-then-insert) — simpler than diffing, and label counts per task are always small. */
export function useTaskLabelLinks(taskId: number | null) {
  const db = useSQLiteContext();
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setLabelIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ label_id: number }>('SELECT label_id FROM task_task_labels WHERE task_id = ?', [taskId]);
      setLabelIds(rows.map((r) => String(r.label_id)));
    } finally {
      setLoading(false);
    }
  }, [db, taskId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const setLabelsFor = useCallback(
    async (targetTaskId: number, nextLabelIds: string[]) => {
      const oldRows = await db.getAllAsync<{ rowid: number }>('SELECT rowid FROM task_task_labels WHERE task_id = ?', [targetTaskId]);
      for (const row of oldRows) {
        await recordDeleteBeforeRemoving(db, 'task_task_labels', row.rowid);
      }

      const now = new Date().toISOString();
      const insertedRowIds: number[] = [];
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM task_task_labels WHERE task_id = ?', [targetTaskId]);
        for (const labelId of nextLabelIds) {
          const result = await db.runAsync(
            'INSERT INTO task_task_labels (task_id, label_id, sync_id, updated_at) VALUES (?, ?, ?, ?)',
            [targetTaskId, Number(labelId), Crypto.randomUUID(), now]
          );
          insertedRowIds.push(result.lastInsertRowId);
        }
      });
      for (const rowid of insertedRowIds) {
        await pushLocalRow(db, 'task_task_labels', rowid);
      }
      await refresh();
    },
    [db, refresh]
  );

  return { labelIds, loading, setLabelsFor, refresh };
}

/** Every label attached to any task, keyed by task id — used by the tasks list screen's
 * label filter chips (see app/(tabs)/tasks/index.tsx), which needs every task's label set at
 * once rather than one task at a time like useTaskLabelLinks above. */
export function useAllTaskLabelLinks() {
  const db = useSQLiteContext();
  const [labelIdsByTask, setLabelIdsByTask] = useState<Record<number, string[]>>({});

  const refresh = useCallback(async () => {
    const rows = await db.getAllAsync<{ task_id: number; label_id: number }>('SELECT task_id, label_id FROM task_task_labels');
    const grouped: Record<number, string[]> = {};
    for (const row of rows) {
      (grouped[row.task_id] ??= []).push(String(row.label_id));
    }
    setLabelIdsByTask(grouped);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { labelIdsByTask, refresh };
}
