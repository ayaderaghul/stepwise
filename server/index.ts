import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, pool } from './db.js';
import { loadUser } from './auth.js';
import { api } from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

const app = express();
app.set('trust proxy', 1); // Render sits in front of us; needed for req.ip and secure cookies.
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  next();
});

app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});

app.use('/api', express.json({ limit: '300kb' }), loadUser, api);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found.' }); });
app.use(express.static(publicDir, { maxAge: '5m' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  const status = (err as { type?: string }).type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({ error: status === 413 ? 'That is too large to save.' : 'Something went wrong on the server.' });
});

const port = Number(process.env.PORT) || 3000;
migrate()
  .then(() => app.listen(port, () => console.log(`Stepwise listening on :${port}`)))
  .catch((err) => { console.error('Database setup failed:', err); process.exit(1); });
