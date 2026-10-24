import { timingSafeEqual } from 'node:crypto';
import { Router, type Response } from 'express';
import { pool } from './db.js';
import { transpile } from './transpile.js';
import {
  createSession, destroySession, hashPassword, requireUser, tooManyAttempts, verifyPassword, type AuthedRequest,
} from './auth.js';

export const api = Router();

const USERNAME = /^[a-z0-9_.-]{3,32}$/;
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

function bad(res: Response, message: string, status = 400) {
  res.status(status).json({ error: message });
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Wrap async handlers so errors reach the error middleware.
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: (err?: unknown) => void) => { fn(req, res).catch(next); };

// ---------------- auth ----------------

api.get('/me', (req: AuthedRequest, res) => {
  if (!req.user) return bad(res, 'Not signed in.', 401);
  res.json({ username: req.user.username });
});

api.get('/signup-info', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  res.json({ inviteRequired: Boolean(process.env.INVITE_CODE) || rows[0].n > 0 });
}));

api.post('/signup', wrap(async (req, res) => {
  if (tooManyAttempts(req.ip ?? 'unknown')) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const invite = String(req.body?.invite ?? '');
  if (!USERNAME.test(username)) return bad(res, 'Username: 3–32 letters, digits, dots, dashes or underscores.');
  if (password.length < 8 || password.length > 200) return bad(res, 'Password must be at least 8 characters.');

  const inviteCode = process.env.INVITE_CODE;
  if (inviteCode) {
    if (!sameSecret(invite, inviteCode)) return bad(res, 'That invite code is not right.', 403);
  } else {
    // Without an invite code configured, only the very first account can be created.
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
    if (rows[0].n > 0) return bad(res, 'Sign-ups are closed.', 403);
  }

  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id',
    [username, hash],
  );
  if (!rows[0]) return bad(res, 'That username is taken.', 409);
  await createSession(res, rows[0].id);
  res.status(201).json({ username });
}));

api.post('/login', wrap(async (req, res) => {
  if (tooManyAttempts(req.ip ?? 'unknown')) return bad(res, 'Too many attempts. Try again in 15 minutes.', 429);
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE username = $1', [username]);
  const ok = rows[0] ? await verifyPassword(password, rows[0].password_hash) : false;
  if (!ok) return bad(res, 'Wrong username or password.', 401);
  await createSession(res, rows[0].id);
  res.json({ username });
}));

api.post('/logout', wrap(async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
}));

// ---------------- progress ----------------

api.get('/progress', requireUser, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT state, updated_at FROM progress WHERE user_id = $1', [req.user!.id]);
  res.json({ state: rows[0]?.state ?? null, updatedAt: rows[0]?.updated_at ?? null });
}));

api.put('/progress', requireUser, wrap(async (req, res) => {
  const state = req.body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return bad(res, 'Expected { state: {...} }.');
  const allowed = ['solved', 'gems', 'shards', 'saved', 'fresh', 'questDone', 'runes', 'review', 'dare', 'peek', 'place', 'bonusGold', 'curio', 'hail', 'sayings'];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) if (key in state) clean[key] = state[key];
  await pool.query(
    `INSERT INTO progress (user_id, state, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [req.user!.id, clean],
  );
  res.json({ ok: true });
}));

// ---------------- code: strip TypeScript types (the browser runs the tests) ----------------

api.post('/transpile', requireUser, (req: AuthedRequest, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : null;
  if (code === null) return bad(res, 'Expected { code }.');
  if (code.length > 50_000) return bad(res, 'That code is too long (50,000 characters max).', 413);
  res.json(transpile(code));
});

// ---------------- attempts ----------------

api.post('/attempts', requireUser, wrap(async (req, res) => {
  const b = req.body ?? {};
  const title = typeof b.title === 'string' ? b.title.slice(0, 200) : '';
  const family = typeof b.family === 'string' ? b.family.slice(0, 60) : '';
  const rank = Number.isInteger(b.rank) ? b.rank : null;
  const answers = Array.isArray(b.answers) ? b.answers.slice(0, 10).map((a: unknown) => String(a ?? '').slice(0, 5000)) : null;
  const code = typeof b.code === 'string' ? b.code.slice(0, 50_000) : '';
  const gems = Number.isInteger(b.gemsEarned) ? Math.max(0, Math.min(20, b.gemsEarned)) : 0;
  const passed = b.passed !== false;
  const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1000 ? (v as number) : null);
  const failure = typeof b.failure === 'string' ? b.failure.slice(0, 2000) : null;
  if (!title || !family || !DIFFICULTIES.has(b.difficulty) || !answers) return bad(res, 'Missing or invalid attempt fields.');
  const { rows } = await pool.query(
    `INSERT INTO attempts (user_id, problem_title, problem_rank, family, difficulty, answers, code, first_clear, gems_earned,
                           passed, tests_passed, tests_total, failure)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, created_at`,
    [req.user!.id, title, rank, family, b.difficulty, JSON.stringify(answers), code, passed && b.firstClear === true, passed ? gems : 0,
      passed, count(b.testsPassed), count(b.testsTotal), failure],
  );
  res.status(201).json(rows[0]);
}));

api.get('/attempts', requireUser, wrap(async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
  const before = Number(req.query.before) || null;
  const { rows } = await pool.query(
    `SELECT id, problem_title AS title, problem_rank AS rank, family, difficulty, first_clear AS "firstClear",
            gems_earned AS "gemsEarned", passed, tests_passed AS "testsPassed", tests_total AS "testsTotal",
            created_at AS "createdAt"
     FROM attempts WHERE user_id = $1 AND ($2::bigint IS NULL OR id < $2)
     ORDER BY id DESC LIMIT $3`,
    [req.user!.id, before, limit],
  );
  res.json({ attempts: rows });
}));

api.get('/attempts/:id', requireUser, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return bad(res, 'Bad id.');
  const { rows } = await pool.query(
    `SELECT id, problem_title AS title, problem_rank AS rank, family, difficulty, answers, code,
            first_clear AS "firstClear", gems_earned AS "gemsEarned", passed, tests_passed AS "testsPassed",
            tests_total AS "testsTotal", failure, created_at AS "createdAt"
     FROM attempts WHERE id = $1 AND user_id = $2`,
    [id, req.user!.id],
  );
  if (!rows[0]) return bad(res, 'Not found.', 404);
  res.json(rows[0]);
}));

// ---------------- stats: streak and a 30-day activity grid, in the viewer's time zone ----------------

function safeTimeZone(tz: unknown): string {
  if (typeof tz !== 'string' || !/^[A-Za-z_+\-/0-9]{1,64}$/.test(tz)) return 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { return 'UTC'; }
}

api.get('/stats', requireUser, wrap(async (req, res) => {
  const tz = safeTimeZone(req.query.tz);
  const { rows } = await pool.query(
    `SELECT to_char((created_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS day,
            count(*)::int AS attempts,
            count(*) FILTER (WHERE first_clear)::int AS clears
     FROM attempts WHERE user_id = $1
     GROUP BY 1 ORDER BY 1 DESC LIMIT 400`,
    [req.user!.id, tz],
  );
  const todayRow = await pool.query(`SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS today`, [tz]);
  const today: string = todayRow.rows[0].today;
  const active = new Set(rows.map((r) => r.day as string));

  const shift = (day: string, delta: number) => {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  // The streak survives until the end of today: count back from today, or from yesterday if today is still empty.
  let cursor = active.has(today) ? today : shift(today, -1);
  let streak = 0;
  while (active.has(cursor)) { streak += 1; cursor = shift(cursor, -1); }
  let best = 0, run = 0, prev = '';
  for (const day of [...active].sort()) {
    run = prev && shift(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  const byDay = new Map(rows.map((r) => [r.day as string, r]));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const day = shift(today, -i);
    const r = byDay.get(day);
    days.push({ day, attempts: r?.attempts ?? 0, clears: r?.clears ?? 0 });
  }
  const totals = await pool.query(
    `SELECT count(*)::int AS attempts, count(*) FILTER (WHERE first_clear)::int AS clears FROM attempts WHERE user_id = $1`,
    [req.user!.id],
  );
  res.json({ today, timeZone: tz, streak, bestStreak: best, days, totals: totals.rows[0] });
}));
