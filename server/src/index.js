import cors from 'cors';
import express from 'express';

import authRouter from './auth.js';
import categoriesRouter from './categories.js';
import { PORT } from './config.js';
import financeRouter from './finance.js';
import habitsRouter from './habits.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/finance', financeRouter);
app.use('/categories', categoriesRouter);
app.use('/habits', habitsRouter);

app.listen(PORT, () => {
  console.log(`lifeos-server listening on http://localhost:${PORT}`);
});
