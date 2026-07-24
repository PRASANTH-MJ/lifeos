import { Router } from 'express';

import { authenticate } from './middleware/authenticate.js';
import { supabase } from './supabase.js';

const router = Router();
router.use(authenticate);

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Categories are not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

// Every new account starts with these, seeded lazily the first time they ask
// for their categories — matches the old per-device SQLite seed, just moved
// to per-user since categories are now shared across a user's devices.
const SEED_CATEGORIES = [
  { name: 'Quit a bad habit', icon: 'close-circle', color: '#FF3B30' },
  { name: 'Art', icon: 'color-palette', color: '#FF2D55' },
  { name: 'Important', icon: 'heart', color: '#FF2D55' },
  { name: 'Meditation', icon: 'body', color: '#AF52DE' },
  { name: 'Study', icon: 'school', color: '#7C4DFF' },
  { name: 'Sports', icon: 'bicycle', color: '#3D8BFF' },
  { name: 'Entertainment', icon: 'game-controller', color: '#00BCD4' },
  { name: 'Pet', icon: 'paw', color: '#26C6DA' },
  { name: 'Social', icon: 'chatbubble', color: '#00BFA5' },
  { name: 'Finance', icon: 'cash', color: '#34C759' },
  { name: 'Health', icon: 'medkit', color: '#34C759' },
  { name: 'Work', icon: 'briefcase', color: '#8BC34A' },
  { name: 'Nutrition', icon: 'nutrition', color: '#F5A623' },
  { name: 'Home', icon: 'home', color: '#FF9500' },
  { name: 'Outdoor', icon: 'trail-sign', color: '#FF7043' },
  { name: 'Other', icon: 'grid', color: '#FF3B30' },
  { name: 'Communication', icon: 'call', color: '#FF6D6D' },
];

router.get('/categories', async (req, res) => {
  const appliesTo = req.query.appliesTo;

  const { count, error: countError } = await supabase
    .from('tag_categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.userId);
  if (countError) return res.status(400).json({ error: countError.message });

  if (count === 0) {
    const { error: seedError } = await supabase
      .from('tag_categories')
      .insert(SEED_CATEGORIES.map((c) => ({ user_id: req.userId, name: c.name, icon: c.icon, color: c.color, applies_to: 'both' })));
    if (seedError) return res.status(400).json({ error: seedError.message });
  }

  let query = supabase.from('tag_categories').select('*').eq('user_id', req.userId).order('name', { ascending: true });
  if (appliesTo === 'habit' || appliesTo === 'task') {
    query = query.or(`applies_to.eq.${appliesTo},applies_to.eq.both`);
  }
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ categories: data });
});

router.post('/categories', async (req, res) => {
  const { name, icon, color, appliesTo } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required.' });
  if (!['habit', 'task', 'both'].includes(appliesTo)) return res.status(400).json({ error: 'Invalid appliesTo.' });

  const { data, error } = await supabase
    .from('tag_categories')
    .insert({ user_id: req.userId, name: name.trim(), icon: icon || 'pricetag', color: color || '#6C63FF', applies_to: appliesTo })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ category: data });
});

export default router;
