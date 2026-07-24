import { Router } from 'express';

import { authenticate } from './middleware/authenticate.js';
import { supabase } from './supabase.js';

const router = Router();
router.use(authenticate);

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Journal is not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  let query = supabase.from('journal_entries').select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
  if (search) query = query.ilike('body', `%${search}%`);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ entries: data });
});

router.post('/', async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.body !== 'string' || !b.body.trim()) return res.status(400).json({ error: 'body is required.' });

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: req.userId, body: b.body, mood: b.mood ?? null, prompt: b.prompt ?? null })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ entry: data });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('journal_entries').select('*').eq('id', req.params.id).eq('user_id', req.userId).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ entry: data });
});

router.patch('/:id', async (req, res) => {
  const b = req.body ?? {};
  const updates = { updated_at: new Date().toISOString() };
  if (b.body !== undefined) updates.body = b.body;
  if (b.mood !== undefined) updates.mood = b.mood;

  const { data, error } = await supabase.from('journal_entries').update(updates).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ entry: data });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('journal_entries').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

export default router;
