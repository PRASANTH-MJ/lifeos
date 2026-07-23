import { Router } from 'express';

import { authenticate } from './middleware/authenticate.js';
import { supabase } from './supabase.js';

const router = Router();
router.use(authenticate);

router.use((req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Finance is not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

// === accounts ================================================================
router.get('/accounts', async (req, res) => {
  const includeArchived = req.query.includeArchived === '1';
  let query = supabase.from('accounts').select('*').eq('user_id', req.userId).order('created_at', { ascending: true });
  if (!includeArchived) query = query.eq('is_archived', false);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ accounts: data });
});

router.post('/accounts', async (req, res) => {
  const { name, type, currency, currentBalance } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required.' });
  if (!['general', 'cash', 'investment', 'credit'].includes(type)) return res.status(400).json({ error: 'Invalid account type.' });

  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: req.userId, name: name.trim(), type, currency: currency || 'USD', current_balance: Number(currentBalance) || 0 })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ account: data });
});

router.patch('/accounts/:id', async (req, res) => {
  const { name, type, currency, isArchived } = req.body ?? {};
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (currency !== undefined) updates.currency = currency;
  if (isArchived !== undefined) updates.is_archived = Boolean(isArchived);

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ account: data });
});

router.delete('/accounts/:id', async (req, res) => {
  const { error } = await supabase.from('accounts').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// === categories (shared content, not user-scoped) ===========================
router.get('/categories', async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('type').order('name');
  if (error) return res.status(400).json({ error: error.message });
  res.json({ categories: data });
});

// === transactions =============================================================
router.get('/transactions', async (req, res) => {
  const { start, end, accountId } = req.query;
  let query = supabase.from('transactions').select('*').eq('user_id', req.userId).order('date', { ascending: false }).order('created_at', { ascending: false });
  if (start) query = query.gte('date', start);
  if (end) query = query.lte('date', end);
  if (accountId) query = query.or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ transactions: data });
});

router.post('/transactions', async (req, res) => {
  const { accountId, toAccountId, categoryId, type, amount, date, note } = req.body ?? {};
  if (!['income', 'expense', 'transfer'].includes(type)) return res.status(400).json({ error: 'Invalid transaction type.' });
  if (!accountId) return res.status(400).json({ error: 'accountId is required.' });
  const numericAmount = Number(amount);
  if (!(numericAmount > 0)) return res.status(400).json({ error: 'amount must be a positive number.' });
  if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
    return res.status(400).json({ error: 'A transfer needs a different destination account.' });
  }

  // Ownership check — account_id/to_account_id must belong to this user, since
  // the DB layer has no RLS to enforce it (service role bypasses RLS by design).
  const accountIds = [accountId, ...(toAccountId ? [toAccountId] : [])];
  const { data: owned, error: ownedError } = await supabase.from('accounts').select('id').eq('user_id', req.userId).in('id', accountIds);
  if (ownedError) return res.status(400).json({ error: ownedError.message });
  if (owned.length !== accountIds.length) return res.status(403).json({ error: 'One or more accounts do not belong to you.' });

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: req.userId,
      account_id: accountId,
      to_account_id: type === 'transfer' ? toAccountId : null,
      category_id: type === 'transfer' ? null : categoryId ?? null,
      type,
      amount: numericAmount,
      date: date || new Date().toISOString().slice(0, 10),
      note: note || null,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ transaction: data });
});

router.patch('/transactions/:id', async (req, res) => {
  const { categoryId, amount, date, note } = req.body ?? {};
  const updates = {};
  if (categoryId !== undefined) updates.category_id = categoryId;
  if (amount !== undefined) updates.amount = Number(amount);
  if (date !== undefined) updates.date = date;
  if (note !== undefined) updates.note = note;
  // Intentionally NOT allowing account_id/to_account_id/type edits here — that
  // reshapes the balance-trigger math in ways worth a delete+recreate instead.

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ transaction: data });
});

router.delete('/transactions/:id', async (req, res) => {
  const { error } = await supabase.from('transactions').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// === summary (net worth + expense-by-category for a date range) =============
router.get('/summary', async (req, res) => {
  const { start, end } = req.query;
  const [{ data: accounts, error: accountsError }, { data: transactions, error: txError }] = await Promise.all([
    supabase.from('accounts').select('current_balance, is_archived').eq('user_id', req.userId),
    supabase
      .from('transactions')
      .select('type, amount, category_id, categories(name, color, icon)')
      .eq('user_id', req.userId)
      .gte('date', start || '1970-01-01')
      .lte('date', end || '9999-12-31'),
  ]);
  if (accountsError) return res.status(400).json({ error: accountsError.message });
  if (txError) return res.status(400).json({ error: txError.message });

  const netWorth = accounts.filter((a) => !a.is_archived).reduce((sum, a) => sum + Number(a.current_balance), 0);
  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

  const byCategory = new Map();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = t.categories?.name ?? 'Uncategorized';
    const existing = byCategory.get(key) ?? { name: key, color: t.categories?.color ?? '#8E8E93', icon: t.categories?.icon ?? 'pricetag', total: 0 };
    existing.total += Number(t.amount);
    byCategory.set(key, existing);
  }

  res.json({
    netWorth,
    income,
    expense,
    expenseByCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
  });
});

export default router;
