import { Router, type Response } from 'express';
import { pool } from './db.js';
import { requireUser, type AuthedRequest } from './auth.js';
import { MINUTE, Polite, cacheGet, cachePut, expiresFrom, fetchJson } from './outside.js';

export const world = Router();

// Endpoints; overridable for tests.
const FORECAST = process.env.OPEN_METEO_FORECAST ?? 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = process.env.OPEN_METEO_GEOCODE ?? 'https://geocoding-api.open-meteo.com/v1/search';
const MET = process.env.MET_FORECAST ?? 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const NOMINATIM = process.env.NOMINATIM_SEARCH ?? 'https://nominatim.openstreetmap.org/search';

const openMeteo = new Polite('open-meteo', 'Open-Meteo weather');
const openMeteoGeo = new Polite('open-meteo-geocoding', 'Open-Meteo place search');
const metNo = new Polite('met-norway', 'MET Norway weather');
const nominatim = new Polite('nominatim', 'OpenStreetMap place search', 1100);
export const loadPauses = () => Polite.loadAll();
const notices = () => Polite.all.map((p) => p.blockedNotice()).filter((x): x is string => !!x);

const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: (err?: unknown) => void) => { fn(req, res).catch(next); };

type Weather = { code: number | null; temp: number | null; isDay: boolean; source: 'open-meteo' | 'met-norway' };

// ---------------- Open-Meteo ----------------
async function openMeteoWeather(lat: number, lon: number): Promise<{ data: Weather; expiresAt: number }> {
  const url = `${FORECAST}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const { body, headers } = await openMeteo.call(() => fetchJson(url));
  const j = body as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
  return {
    data: { code: j.current?.weather_code ?? null, temp: j.current?.temperature_2m ?? null, isDay: j.current?.is_day === 1, source: 'open-meteo' },
    expiresAt: expiresFrom(headers, 30 * MINUTE),
  };
}

// ---------------- MET Norway ----------------
// MET Norway symbol codes → the WMO codes the game understands.
export function metToWmo(symbol: string): number {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  if (s === 'fog') return 45;
  if (s.includes('snow') || s.includes('sleet')) return s.includes('showers') ? 85 : 73;
  if (s.includes('rainshowers')) return 80;
  if (s.includes('rain')) return s.startsWith('heavy') ? 65 : s.startsWith('light') ? 61 : 63;
  if (s === 'clearsky') return 0;
  if (s === 'fair') return 1;
  if (s === 'partlycloudy') return 2;
  return 3;
}
function readMet(body: unknown): Weather {
  const j = body as { properties?: { timeseries?: Array<{ data?: { instant?: { details?: { air_temperature?: number } };
    next_1_hours?: { summary?: { symbol_code?: string } }; next_6_hours?: { summary?: { symbol_code?: string } } } }> } };
  const now = j.properties?.timeseries?.[0]?.data;
  const symbol = now?.next_1_hours?.summary?.symbol_code ?? now?.next_6_hours?.summary?.symbol_code;
  if (!symbol) throw new Error('MET Norway: no weather symbol in the response');
  return { code: metToWmo(symbol), temp: now?.instant?.details?.air_temperature ?? null, isDay: !/_night$/.test(symbol), source: 'met-norway' };
}
// Expires and Last-Modified are stored in Postgres (outside_cache), so they survive a restart:
// before Expires we never ask again; after it we revalidate with If-Modified-Since.
export async function metWeather(lat: number, lon: number): Promise<{ data: Weather; expiresAt: number }> {
  const qlat = lat.toFixed(2), qlon = lon.toFixed(2); // MET allows at most 4 decimals; 2 lets neighbours share
  const key = `met:${qlat},${qlon}`;
  const stored = await cacheGet(key);
  if (stored && Date.now() < stored.expiresAt) return { data: readMet(stored.body), expiresAt: stored.expiresAt };
  const r = await metNo.call(() => fetchJson(`${MET}?lat=${qlat}&lon=${qlon}`, stored?.lastModified));
  if (r.status === 203) console.warn('MET Norway says this product version is deprecated (HTTP 203)');
  const expiresAt = expiresFrom(r.headers, 30 * MINUTE);
  const lastModified = r.headers.get('last-modified') ?? stored?.lastModified ?? null;
  if (r.status === 304 && stored) {
    await cachePut(key, stored.body, expiresAt, lastModified);
    return { data: readMet(stored.body), expiresAt };
  }
  const data = readMet(r.body);
  await cachePut(key, r.body, expiresAt, lastModified);
  return { data, expiresAt };
}

// ---------------- /api/weather ----------------
// Each ~10 km cell is kept for 30 minutes, or until MET Norway's Expires if that is later. If every
// service fails, the last reading for the cell (up to 6 hours old) is served, marked stale.
const inflight = new Map<string, Promise<Weather>>();
async function freshWeather(key: string, lat: number, lon: number): Promise<Weather> {
  let got: { data: Weather; expiresAt: number };
  try { got = await openMeteoWeather(lat, lon); } catch { got = await metWeather(lat, lon); }
  await cachePut(key, got.data, Math.max(Date.now() + 30 * MINUTE, got.expiresAt));
  return got.data;
}

world.get('/weather', requireUser, wrap(async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: 'Bad coordinates.' });
    return;
  }
  const key = `wx:${lat.toFixed(1)},${lon.toFixed(1)}`;
  const hit = await cacheGet(key);
  if (hit && Date.now() < hit.expiresAt) { res.json({ ...(hit.body as Weather), notices: notices() }); return; }
  try {
    let pending = inflight.get(key); // requests for the same cell share one lookup
    if (!pending) { pending = freshWeather(key, lat, lon).finally(() => inflight.delete(key)); inflight.set(key, pending); }
    res.json({ ...(await pending), notices: notices() });
  } catch (err) {
    console.error('weather lookup failed:', (err as Error).message);
    if (hit && Date.now() - hit.fetchedAt < 6 * 60 * MINUTE) { res.json({ ...(hit.body as Weather), stale: true, notices: notices() }); return; }
    res.status(502).json({ error: 'The weather spirits are quiet right now. Try again later.', notices: notices() });
  }
}));

// ---------------- /api/geocode ----------------
// Searches run only when the explorer presses FIND (Nominatim forbids autocomplete). Results are cached for
// 30 days (an empty result for 1 day), so the same city is never asked twice.
type Place = { name: string; country: string; region: string; lat: number; lon: number };
const round = (n: number) => Math.round(n * 1000) / 1000;
async function searchPlaces(q: string): Promise<{ results: Place[]; source: 'open-meteo' | 'nominatim' }> {
  try {
    const { body } = await openMeteoGeo.call(() => fetchJson(`${GEOCODE}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`));
    const j = body as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }> };
    return { source: 'open-meteo', results: (j.results ?? []).map((r) => ({ name: r.name, country: r.country ?? '', region: r.admin1 ?? '', lat: round(r.latitude), lon: round(r.longitude) })) };
  } catch {
    const { body } = await nominatim.call(() => fetchJson(`${NOMINATIM}?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&addressdetails=1&accept-language=en`));
    const j = body as Array<{ name?: string; display_name: string; lat: string; lon: string; address?: { country?: string; state?: string; region?: string } }>;
    return { source: 'nominatim', results: j.map((r) => ({
      name: r.name || r.display_name.split(',')[0], country: r.address?.country ?? '', region: r.address?.state ?? r.address?.region ?? '',
      lat: round(Number(r.lat)), lon: round(Number(r.lon)),
    })) };
  }
}
world.get('/geocode', requireUser, wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) { res.status(400).json({ error: 'Type at least two letters.' }); return; }
  const key = 'geo:' + q.toLowerCase();
  const hit = await cacheGet(key);
  if (hit && Date.now() < hit.expiresAt) { res.json({ ...(hit.body as object), notices: notices() }); return; }
  try {
    const found = await searchPlaces(q);
    await cachePut(key, found, Date.now() + (found.results.length ? 30 * 24 * 60 : 24 * 60) * MINUTE);
    res.json({ ...found, notices: notices() });
  } catch (err) {
    console.error('place search failed:', (err as Error).message);
    res.status(502).json({ error: 'Couldn’t search for places right now.', notices: notices() });
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
