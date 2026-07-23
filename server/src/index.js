import cors from 'cors';
import express from 'express';

import authRouter from './auth.js';
import { PORT } from './config.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`lifeos-server listening on http://localhost:${PORT}`);
});
