import { Router } from 'express';

import { authenticate } from './middleware/authenticate.js';
import { supabase } from './supabase.js';

const router = Router();
router.use(authenticate);

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Tasks are not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

async function assertOwnsTask(userId, taskId) {
  const { data, error } = await supabase.from('tasks').select('id').eq('id', taskId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

function applyTaskUpdates(b) {
  const updates = {};
  if (b.title !== undefined) updates.title = b.title;
  if (b.notes !== undefined) updates.notes = b.notes;
  if (b.priority !== undefined) updates.priority = b.priority;
  if (b.categoryId !== undefined) updates.category_id = b.categoryId;
  if (b.important !== undefined) updates.important = Boolean(b.important);
  if (b.dueDate !== undefined) updates.due_date = b.dueDate;
  if (b.dueTime !== undefined) updates.due_time = b.dueTime;
  if (b.completedAt !== undefined) updates.completed_at = b.completedAt;
  if (b.recurrenceFrequency !== undefined) updates.recurrence_frequency = b.recurrenceFrequency;
  if (b.recurrenceDays !== undefined) updates.recurrence_days = JSON.stringify(b.recurrenceDays);
  if (b.periodTargetCount !== undefined) updates.period_target_count = b.periodTargetCount;
  if (b.periodLengthDays !== undefined) updates.period_length_days = b.periodLengthDays;
  if (b.reminderOffsetMinutes !== undefined) updates.reminder_offset_minutes = b.reminderOffsetMinutes;
  if (b.alarmEnabled !== undefined) updates.alarm_enabled = Boolean(b.alarmEnabled);
  if (b.archived !== undefined) updates.archived = Boolean(b.archived);
  if (b.sortOrder !== undefined) updates.sort_order = b.sortOrder;
  return updates;
}

// === top-level tasks ==========================================================
// ?recurring=1 for the Recurring Tasks list, otherwise the plain one-time list.
router.get('/', async (req, res) => {
  const recurring = req.query.recurring === '1';
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', req.userId)
    .eq('archived', false)
    .is('parent_task_id', null)
    .eq('is_recurring', recurring);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ tasks: data });
});

// Subtask done/total counts per parent, for non-archived subtasks — mirrors
// the old GROUP BY query, computed here since Supabase has no raw SQL access.
router.get('/subtask-counts', async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('parent_task_id, completed_at')
    .eq('user_id', req.userId)
    .eq('archived', false)
    .not('parent_task_id', 'is', null);
  if (error) return res.status(400).json({ error: error.message });

  const counts = {};
  for (const row of data) {
    const bucket = (counts[row.parent_task_id] ??= { total: 0, done: 0 });
    bucket.total += 1;
    if (row.completed_at) bucket.done += 1;
  }
  res.json({ counts });
});

router.post('/', async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.title !== 'string' || !b.title.trim()) return res.status(400).json({ error: 'title is required.' });

  if (b.parentTaskId) {
    const owns = await assertOwnsTask(req.userId, b.parentTaskId);
    if (!owns) return res.status(404).json({ error: 'Parent task not found.' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: req.userId,
      title: b.title.trim(),
      notes: b.notes ?? null,
      priority: b.priority || 'medium',
      category_id: b.categoryId ?? null,
      important: Boolean(b.important),
      due_date: b.dueDate ?? null,
      due_time: b.dueTime ?? null,
      reminder_offset_minutes: b.reminderOffsetMinutes ?? null,
      alarm_enabled: Boolean(b.alarmEnabled),
      parent_task_id: b.parentTaskId ?? null,
      sort_order: b.sortOrder ?? 0,
      is_recurring: Boolean(b.isRecurring),
      recurrence_frequency: b.recurrenceFrequency ?? null,
      recurrence_days: JSON.stringify(b.recurrenceDays ?? []),
      period_target_count: b.periodTargetCount ?? null,
      period_length_days: b.periodLengthDays ?? null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ task: data });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', req.params.id).eq('user_id', req.userId).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Task not found.' });
  res.json({ task: data });
});

router.patch('/:id', async (req, res) => {
  const updates = applyTaskUpdates(req.body ?? {});
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ task: data });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// === subtasks ==================================================================
router.get('/:id/subtasks', async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', req.params.id)
    .eq('user_id', req.userId)
    .eq('archived', false)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ subtasks: data });
});

// === task completions (recurring-task logs + one-time fail/skip nuance) =====
// All of the user's completions across every task — mirrors the old unbounded
// local query, used by the Recurring Tasks list to compute today's status/streaks.
router.get('/completions', async (req, res) => {
  const { data, error } = await supabase.from('task_completions').select('*').eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ completions: data });
});

router.get('/:id/completions', async (req, res) => {
  const owns = await assertOwnsTask(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Task not found.' });

  const { data, error } = await supabase.from('task_completions').select('*').eq('task_id', req.params.id).order('date', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ completions: data });
});

router.put('/:id/completions/:date', async (req, res) => {
  const owns = await assertOwnsTask(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Task not found.' });

  const { data, error } = await supabase
    .from('task_completions')
    .upsert(
      {
        user_id: req.userId,
        task_id: req.params.id,
        date: req.params.date,
        status: req.body?.status || 'done',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'task_id,date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ completion: data });
});

router.delete('/:id/completions/:date', async (req, res) => {
  const owns = await assertOwnsTask(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Task not found.' });

  const { error } = await supabase.from('task_completions').delete().eq('task_id', req.params.id).eq('date', req.params.date);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// Wipes a single recurring task's whole history ("clear history") without deleting the task.
router.delete('/:id/completions', async (req, res) => {
  const owns = await assertOwnsTask(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Task not found.' });

  const { error } = await supabase.from('task_completions').delete().eq('task_id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

export default router;
