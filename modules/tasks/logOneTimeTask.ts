import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';
import type { Task, TaskLogStatus } from './types';

/**
 * One-time tasks have no recurring-style "due today" concept, so their status
 * lives in task_completions (for the fail/skip nuance) but `completed_at` on the
 * tasks row stays the single source of truth everywhere else (Tasks tab sort,
 * Calendar, Analytics) — these two helpers keep both in sync.
 */
export async function logOneTimeTaskStatus(
  db: SQLiteDatabase,
  task: Task,
  status: TaskLogStatus,
  date: string,
  toggleComplete: (task: Task) => Promise<void>
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM task_completions WHERE task_id = ? AND date = ?', [task.id, date]);
  const now = new Date().toISOString();
  if (existing) {
    await db.runAsync('UPDATE task_completions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?', [
      status,
      now,
      now,
      existing.id,
    ]);
    await pushLocalRow(db, 'task_completions', existing.id);
  } else {
    const result = await db.runAsync(
      'INSERT INTO task_completions (task_id, date, status, completed_at, sync_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [task.id, date, status, now, Crypto.randomUUID(), now]
    );
    await pushLocalRow(db, 'task_completions', result.lastInsertRowId);
  }
  const completing = status === 'done';
  if (Boolean(task.completed_at) !== completing) {
    await toggleComplete(task);
  }
}

export async function clearOneTimeTaskLog(
  db: SQLiteDatabase,
  task: Task,
  date: string,
  toggleComplete: (task: Task) => Promise<void>
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM task_completions WHERE task_id = ? AND date = ?', [task.id, date]);
  if (existing) {
    await recordDeleteBeforeRemoving(db, 'task_completions', existing.id);
  }
  await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', [task.id, date]);
  if (task.completed_at) {
    await toggleComplete(task);
  }
}
