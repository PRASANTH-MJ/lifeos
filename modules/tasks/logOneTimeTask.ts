import type { SQLiteDatabase } from 'expo-sqlite';

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
  if (existing) {
    await db.runAsync('UPDATE task_completions SET status = ?, completed_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      existing.id,
    ]);
  } else {
    await db.runAsync('INSERT INTO task_completions (task_id, date, status, completed_at) VALUES (?, ?, ?, ?)', [
      task.id,
      date,
      status,
      new Date().toISOString(),
    ]);
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
  await db.runAsync('DELETE FROM task_completions WHERE task_id = ? AND date = ?', [task.id, date]);
  if (task.completed_at) {
    await toggleComplete(task);
  }
}
