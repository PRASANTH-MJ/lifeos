import { Router } from 'express';

import { authenticate } from './middleware/authenticate.js';
import { supabase } from './supabase.js';

const router = Router();
router.use(authenticate);

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Habits are not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

async function assertOwnsHabit(userId, habitId) {
  const { data, error } = await supabase.from('habits').select('id').eq('id', habitId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// === habits ===================================================================
router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === '1';
  let query = supabase.from('habits').select('*').eq('user_id', req.userId).order('created_at', { ascending: true });
  if (!includeArchived) query = query.eq('archived', false);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ habits: data });
});

router.post('/', async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.name !== 'string' || !b.name.trim()) return res.status(400).json({ error: 'name is required.' });
  if (!b.frequency) return res.status(400).json({ error: 'frequency is required.' });

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: req.userId,
      name: b.name.trim(),
      icon: b.icon || 'checkmark-circle',
      category_id: b.categoryId ?? null,
      tracking_type: b.trackingType || 'yesno',
      target_value: b.targetValue ?? null,
      target_unit: b.targetUnit ?? null,
      target_comparator: b.targetComparator || 'at_least',
      checklist_items: JSON.stringify(b.checklistItems ?? []),
      checklist_success_mode: b.checklistSuccessMode || 'all',
      checklist_min_count: b.checklistMinCount ?? 0,
      frequency: b.frequency,
      target_days: JSON.stringify(b.targetDays ?? []),
      period_target_count: b.periodTargetCount ?? null,
      period_length_days: b.periodLengthDays ?? null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ habit: data });
});

router.patch('/:id', async (req, res) => {
  const b = req.body ?? {};
  const updates = {};
  if (b.name !== undefined) updates.name = b.name;
  if (b.icon !== undefined) updates.icon = b.icon;
  if (b.categoryId !== undefined) updates.category_id = b.categoryId;
  if (b.trackingType !== undefined) updates.tracking_type = b.trackingType;
  if (b.targetValue !== undefined) updates.target_value = b.targetValue;
  if (b.targetUnit !== undefined) updates.target_unit = b.targetUnit;
  if (b.targetComparator !== undefined) updates.target_comparator = b.targetComparator;
  if (b.checklistItems !== undefined) updates.checklist_items = JSON.stringify(b.checklistItems);
  if (b.checklistSuccessMode !== undefined) updates.checklist_success_mode = b.checklistSuccessMode;
  if (b.checklistMinCount !== undefined) updates.checklist_min_count = b.checklistMinCount;
  if (b.frequency !== undefined) updates.frequency = b.frequency;
  if (b.targetDays !== undefined) updates.target_days = JSON.stringify(b.targetDays);
  if (b.periodTargetCount !== undefined) updates.period_target_count = b.periodTargetCount;
  if (b.periodLengthDays !== undefined) updates.period_length_days = b.periodLengthDays;
  if (b.archived !== undefined) updates.archived = Boolean(b.archived);

  const { data, error } = await supabase.from('habits').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ habit: data });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('habits').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// === habit logs ================================================================
// All of the user's logs across every habit — mirrors the old unbounded local
// query (`SELECT * FROM habit_logs`), used by the Habits list to compute
// streaks client-side.
router.get('/logs', async (req, res) => {
  const { data, error } = await supabase.from('habit_logs').select('*').eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ logs: data });
});

router.get('/:id/logs', async (req, res) => {
  const owns = await assertOwnsHabit(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Habit not found.' });

  const { data, error } = await supabase.from('habit_logs').select('*').eq('habit_id', req.params.id).order('date', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ logs: data });
});

router.put('/:id/logs/:date', async (req, res) => {
  const owns = await assertOwnsHabit(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Habit not found.' });

  const b = req.body ?? {};
  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      {
        user_id: req.userId,
        habit_id: req.params.id,
        date: req.params.date,
        status: b.status || 'done',
        value: b.value ?? null,
        checklist_checked: b.checklistChecked ? JSON.stringify(b.checklistChecked) : null,
        note: b.note ?? null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'habit_id,date' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ log: data });
});

router.delete('/:id/logs/:date', async (req, res) => {
  const owns = await assertOwnsHabit(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Habit not found.' });

  const { error } = await supabase.from('habit_logs').delete().eq('habit_id', req.params.id).eq('date', req.params.date);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// Wipes a single habit's whole history ("restart progress") without deleting the habit.
router.delete('/:id/logs', async (req, res) => {
  const owns = await assertOwnsHabit(req.userId, req.params.id);
  if (!owns) return res.status(404).json({ error: 'Habit not found.' });

  const { error } = await supabase.from('habit_logs').delete().eq('habit_id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

export default router;
