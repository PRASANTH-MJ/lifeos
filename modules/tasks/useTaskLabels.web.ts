import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

import type { TaskLabel } from './types';

type LabelRow = { id: number; name: string; color: string };
type TaskLabelLinkRow = { task_id: number; label_id: number; sync_id?: string };

/**
 * Web build of useTaskLabels.ts — same exported shape. Reactive via Dexie's useLiveQuery instead
 * of expo-router's useFocusEffect: a write from any tab (or the sync engine) flows into every
 * mounted instance automatically.
 */
export function useTaskLabels() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.task_labels.toArray()) as LabelRow[];
    // Plain code-point comparison, not localeCompare — matches SQLite's default BINARY
    // collation (case-sensitive, byte-value order) that native's `ORDER BY name ASC` uses.
    return [...all].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }, []);

  const loading = rows === undefined;
  const labels: TaskLabel[] = (rows ?? []).map((r) => ({ id: String(r.id), name: r.name, color: r.color }));

  const addLabel = useCallback(async (name: string, color = '#8E8E93') => {
    const id = await webDb.task_labels.add({
      name,
      color,
      updated_at: new Date().toISOString(),
      sync_id: Crypto.randomUUID(),
    } as never);
    await pushLocalRow('task_labels', id as number);
    return String(id);
  }, []);

  const editLabel = useCallback(async (id: string, name: string, color: string) => {
    await webDb.task_labels.update(Number(id), { name, color, updated_at: new Date().toISOString() });
    await pushLocalRow('task_labels', Number(id));
  }, []);

  const removeLabel = useCallback(async (id: string) => {
    await recordDeleteBeforeRemoving('task_labels', Number(id));
    await webDb.task_labels.delete(Number(id));
  }, []);

  return { labels, loading, addLabel, editLabel, removeLabel };
}

/** Labels attached to one task, plus a setter that replaces the full set in one go
 * (delete-then-insert) — simpler than diffing, and label counts per task are always small. */
export function useTaskLabelLinks(taskId: number | null) {
  const rows = useLiveQuery(async () => {
    if (!taskId) return [];
    const all = (await webDb.task_task_labels.toArray()) as TaskLabelLinkRow[];
    return all.filter((r) => r.task_id === taskId);
  }, [taskId]);

  const loading = rows === undefined;
  const labelIds: string[] = (rows ?? []).map((r) => String(r.label_id));

  const setLabelsFor = useCallback(async (targetTaskId: number, nextLabelIds: string[]) => {
    const now = new Date().toISOString();
    const existing = (await webDb.task_task_labels.where('task_id').equals(targetTaskId).toArray()) as TaskLabelLinkRow[];
    for (const row of existing) {
      await recordDeleteBeforeRemoving('task_task_labels', [row.task_id, row.label_id]);
    }

    const nextRows = nextLabelIds.map((labelId) => ({
      task_id: targetTaskId,
      label_id: Number(labelId),
      sync_id: Crypto.randomUUID(),
      updated_at: now,
    }));
    await webDb.transaction('rw', [webDb.task_task_labels], async () => {
      await webDb.task_task_labels.bulkDelete(existing.map((r) => [r.task_id, r.label_id] as never));
      await webDb.task_task_labels.bulkAdd(nextRows as never[]);
    });
    for (const row of nextRows) {
      await pushLocalRow('task_task_labels', [row.task_id, row.label_id]);
    }
  }, []);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { labelIds, loading, setLabelsFor, refresh };
}

/** Every label attached to any task, keyed by task id — used by the tasks list screen's label
 * filter chips (see app/(tabs)/tasks/index.tsx). */
export function useAllTaskLabelLinks() {
  const rows = useLiveQuery(async () => (await webDb.task_task_labels.toArray()) as TaskLabelLinkRow[], []);

  const labelIdsByTask: Record<number, string[]> = {};
  for (const row of rows ?? []) {
    (labelIdsByTask[row.task_id] ??= []).push(String(row.label_id));
  }

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  return { labelIdsByTask, refresh };
}
