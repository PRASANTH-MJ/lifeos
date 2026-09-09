import * as Crypto from 'expo-crypto';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';
import type { Task, TaskLogStatus } from './types';

/**
 * Web build of logOneTimeTask.ts — same behavior, against webDb.task_completions instead of
 * raw SQL, dropping the leading `db` parameter (webDb is a module singleton, not a
 * React-context-provided handle) since every caller on web already invokes these with 4 args.
 */
export async function logOneTimeTaskStatus(
  task: Task,
  status: TaskLogStatus,
  date: string,
  toggleComplete: (task: Task) => Promise<void>
): Promise<void> {
  const existing = (await webDb.task_completions
    .where('task_id')
    .equals(task.id)
    .and((row) => (row as { date: string }).date === date)
    .first()) as { id: number } | undefined;
  const now = new Date().toISOString();

  if (existing) {
    await webDb.task_completions.update(existing.id, { status, completed_at: now, updated_at: now });
    await pushLocalRow('task_completions', existing.id);
  } else {
    const id = await webDb.task_completions.add({
      task_id: task.id,
      date,
      status,
      completed_at: now,
      sync_id: Crypto.randomUUID(),
      updated_at: now,
    } as never);
    await pushLocalRow('task_completions', id as number);
  }

  const completing = status === 'done';
  if (Boolean(task.completed_at) !== completing) {
    await toggleComplete(task);
  }
}

export async function clearOneTimeTaskLog(
  task: Task,
  date: string,
  toggleComplete: (task: Task) => Promise<void>
): Promise<void> {
  const existing = (await webDb.task_completions
    .where('task_id')
    .equals(task.id)
    .and((row) => (row as { date: string }).date === date)
    .first()) as { id: number } | undefined;

  if (existing) {
    await recordDeleteBeforeRemoving('task_completions', existing.id);
    await webDb.task_completions.delete(existing.id);
  }

  if (task.completed_at) {
    await toggleComplete(task);
  }
}
