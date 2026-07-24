import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

import { findUserByEmail, findUserById, findUserByUsername, insertUser, usersConfigured } from './db.js';
import { JWT_SECRET } from './config.js';

const router = Router();
const TOKEN_TTL = '30d';

function toPublicUser(row) {
  return { id: row.id, email: row.email, username: row.username, createdAt: row.created_at };
}

router.use((req, res, next) => {
  if (!usersConfigured()) {
    return res.status(503).json({ error: 'Accounts are not configured on this server yet (missing Supabase credentials).' });
  }
  next();
});

router.post('/signup', async (req, res) => {
  const { email, username, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email, username, and password are all required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  const [byEmail, byUsername] = await Promise.all([
    findUserByEmail(normalizedEmail),
    findUserByUsername(normalizedUsername),
  ]);
  if (byEmail || byUsername) {
    return res.status(409).json({ error: 'An account with that email or username already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await insertUser({ email: normalizedEmail, username: normalizedUsername, passwordHash });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'An account with that email or username already exists.' });
    }
    throw err;
  }

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.status(201).json({ token, user: toPublicUser(user) });
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body ?? {};
  if (typeof identifier !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'identifier and password are required.' });
  }

  const normalized = identifier.trim().toLowerCase();
  const [byEmail, byUsername] = await Promise.all([
    findUserByEmail(normalized),
    findUserByUsername(normalized),
  ]);
  const user = byEmail ?? byUsername;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, user: toPublicUser(user) });
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return res.status(401).json({ error: 'Missing token.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists.' });
    res.json({ user: toPublicUser(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;
