import { Router, type Response } from 'express';
import { pool } from './db.js';
import { requireUser, type AuthedRequest } from './auth.js';

export const world = Router();

// Open-Meteo is free and needs no key. The bases are overridable for tests.
const FORECAST = process.env.OPEN_METEO_FORECAST ?? 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = process.env.OPEN_METEO_GEOCODE ?? 'https://geocoding-api.open-meteo.com/v1/search';

const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: (err?: unknown) => void) => { fn(req, res).catch(next); };

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'stepwise-app' } });
  if (!r.ok) throw new Error('upstream ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

// ---------------- weather: cached for 30 minutes per ~10 km grid cell ----------------
const weatherCache = new Map<string, { at: number; data: unknown }>();

world.get('/weather', requireUser, wrap(async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: 'Bad coordinates.' });
    return;
  }
  const key = lat.toFixed(1) + ',' + lon.toFixed(1);
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) { res.json(hit.data); return; }
  try {
    const url = `${FORECAST}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const j = await getJson(url) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number }; timezone?: string };
    const data = {
      code: j.current?.weather_code ?? null,
      temp: j.current?.temperature_2m ?? null,
      isDay: j.current?.is_day === 1,
      timezone: j.timezone ?? null
    };
    weatherCache.set(key, { at: Date.now(), data });
    if (weatherCache.size > 2000) weatherCache.delete(weatherCache.keys().next().value as string);
    res.json(data);
  } catch (err) {
    console.error('weather lookup failed:', (err as Error).message, (err as { cause?: unknown }).cause ?? '');
    res.status(502).json({ error: 'The weather spirits are quiet right now. Try again later.' });
  }
}));

world.get('/geocode', requireUser, wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q.length < 2) { res.status(400).json({ error: 'Type at least two letters.' }); return; }
  try {
    const j = await getJson(`${GEOCODE}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`) as {
      results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }>;
    };
    res.json({
      results: (j.results ?? []).map((r) => ({
        name: r.name, country: r.country ?? '', region: r.admin1 ?? '',
        lat: Math.round(r.latitude * 1000) / 1000, lon: Math.round(r.longitude * 1000) / 1000
      }))
    });
  } catch (err) {
    console.error('geocode failed:', (err as Error).message, (err as { cause?: unknown }).cause ?? '');
    res.status(502).json({ error: 'Couldn’t search for places right now.' });
  }
}));

// ---------------- gold and the Hall of Explorers ----------------
// Gold per gem, by how much mental energy the topic takes. Must match public/logic.js.
export const GOLD: Record<string, number> = {
  'Arrays & hashing': 10, 'Math & bits': 10, 'Stack & queue': 14, 'Two pointers & window': 14, 'Greedy & intervals': 16,
  'Binary search': 18, 'Linked list': 20, 'Trees & BST': 22, 'Heap': 24, 'Backtracking': 26, 'Graphs': 28,
  'Dynamic programming': 32, 'Trie': 60, 'Segment tree': 80
};
export const RANKS: Array<[number, string, string]> = [
  [4000, 'Temple Monarch', 'monarch'], [2000, 'Rune Sage', 'runesage'], [1000, 'Archivist', 'archivist'],
  [600, 'Cartographer', 'cartographer'], [300, 'Pathfinder', 'pathfinder'], [100, 'Scout', 'scout'], [0, 'Wanderer', 'wanderer']
];
function rankFor(gold: number) { return RANKS.find((r) => gold >= r[0]) ?? RANKS[RANKS.length - 1]; }

export function goldOf(state: Record<string, unknown> | null): number {
  if (!state) return 0;
  const gems = (state.gems ?? {}) as Record<string, number>;
  const shards = (state.shards ?? {}) as Record<string, number>;
  let total = 0;
  for (const fam of Object.keys(GOLD)) {
    total += (Number(gems[fam]) || 0) * GOLD[fam];
    total += Math.floor(((Number(shards[fam]) || 0) * GOLD[fam]) / 5);
  }
  total += Math.max(0, Math.floor(Number(state.bonusGold) || 0));
  return total;
}

world.get('/leaderboard', requireUser, wrap(async (req, res) => {
  const { rows: users } = await pool.query(
    `SELECT u.id, u.username, p.state FROM users u LEFT JOIN progress p ON p.user_id = u.id`
  );
  const { rows: week } = await pool.query(
    `SELECT user_id, family, sum(gems_earned)::int AS gems FROM attempts
     WHERE passed AND created_at > now() - interval '7 days' GROUP BY user_id, family`
  );
  const weekly = new Map<number, number>();
  for (const w of week) weekly.set(w.user_id, (weekly.get(w.user_id) ?? 0) + w.gems * (GOLD[w.family] ?? 10));
  const board = users.map((u) => {
    const gold = goldOf(u.state);
    const solved = u.state && u.state.solved ? Object.keys(u.state.solved).length : 0;
    const r = rankFor(gold);
    return { username: u.username, gold, week: weekly.get(u.id) ?? 0, solved, rank: r[1], sprite: r[2], you: u.id === req.user!.id };
  });
  const period = req.query.period === 'week' ? 'week' : 'all';
  board.sort((a, b) => (period === 'week' ? b.week - a.week || b.gold - a.gold : b.gold - a.gold || b.week - a.week) || a.username.localeCompare(b.username));
  res.json({ period, explorers: board.slice(0, 100).map((e, i) => ({ place: i + 1, ...e })) });
}));

// One probe at start-up, so the logs show whether the weather service is reachable from this host.
export function probeWeather() {
  getJson(`${FORECAST}?latitude=41.9&longitude=12.5&current=temperature_2m,weather_code,is_day&timezone=auto`)
    .then((j) => console.log('weather probe ok:', JSON.stringify((j as { current?: unknown }).current)))
    .catch((err) => console.error('weather probe failed:', (err as Error).message, (err as { cause?: unknown }).cause ?? ''));
}
