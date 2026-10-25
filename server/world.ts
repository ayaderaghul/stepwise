import { Router, type Response } from 'express';
import { pool } from './db.js';
import { requireUser, type AuthedRequest } from './auth.js';

export const world = Router();

// Open-Meteo is free and needs no key. The bases are overridable for tests.
const FORECAST = process.env.OPEN_METEO_FORECAST ?? 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = process.env.OPEN_METEO_GEOCODE ?? 'https://geocoding-api.open-meteo.com/v1/search';
// Backups when Open-Meteo refuses (its free quota is per IP, and Render's outbound IPs are shared).
const MET = process.env.MET_FORECAST ?? 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const NOMINATIM = process.env.NOMINATIM_SEARCH ?? 'https://nominatim.openstreetmap.org/search';
const UA = 'stepwise-app/1.0 (+https://stepwise-app-izre.onrender.com)';

const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: (err?: unknown) => void) => { fn(req, res).catch(next); };

class UpstreamError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null) { super(message); }
}
async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': UA } });
  if (!r.ok) {
    const ra = r.headers.get('retry-after');
    const secs = ra && /^\d+$/.test(ra) ? Number(ra) * 1000 : ra ? Date.parse(ra) - Date.now() : NaN;
    throw new UpstreamError('upstream ' + r.status + ' ' + (await r.text()).slice(0, 200), r.status, Number.isFinite(secs) && secs > 0 ? secs : null);
  }
  return r.json();
}

// ---------------- polite callers: each outside service gets its own cool-down ----------------
// After a failure we stop calling that service for a while instead of retrying on every request:
// - a daily-quota refusal waits until just after the next UTC midnight (when Open-Meteo resets);
// - a Retry-After header is obeyed (up to a day);
// - 403 (we are blocked) waits an hour;
// - anything else (5xx, 429, timeouts, network errors) backs off 1, 2, 4 … up to 60 minutes;
// - 400/404 are about that one request, so they do not trip the cool-down.
// Calls are also spaced out (minGapMs), which Nominatim's usage policy asks for (1 per second).
const MINUTE = 60 * 1000;
class Polite {
  private until = 0;
  private failures = 0;
  private last = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly name: string, private readonly minGapMs = 0) {}
  coolingDown() { return Date.now() < this.until; }
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const resting = () => new Error(`${this.name}: cooling down for ${Math.ceil((this.until - Date.now()) / MINUTE)} more min`);
    if (this.coolingDown()) throw resting();
    const run = async () => {
      // Checked again here: a call that queued behind one that just failed must not go out.
      if (this.coolingDown()) throw resting();
      const wait = this.last + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      try {
        const out = await fn();
        this.failures = 0;
        return out;
      } catch (err) {
        this.trip(err);
        throw err;
      }
    };
    // One call at a time per service, so a burst of page loads does not become a burst of requests.
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
  private trip(err: unknown) {
    const e = err as UpstreamError;
    if (e.status === 400 || e.status === 404) return;
    this.failures += 1;
    let ms: number;
    if (e.status === 429 && /daily|day/i.test(e.message)) {
      const d = new Date(); d.setUTCHours(24, 5, 0, 0); ms = d.getTime() - Date.now();
    } else if (e.retryAfterMs) ms = Math.min(e.retryAfterMs, 24 * 60 * MINUTE);
    else if (e.status === 403) ms = 60 * MINUTE;
    else ms = Math.min(MINUTE * 2 ** (this.failures - 1), 60 * MINUTE);
    this.until = Date.now() + ms;
    console.error(`${this.name} failed (${e.message}); pausing calls for ${Math.round(ms / MINUTE)} min`);
  }
}
const openMeteo = new Polite('open-meteo');
const openMeteoGeo = new Polite('open-meteo geocoding');
const metNo = new Polite('met.no');
const nominatim = new Polite('nominatim', 1100);

type Weather = { code: number | null; temp: number | null; isDay: boolean; timezone: string | null; source: string };

async function openMeteoWeather(lat: number, lon: number): Promise<Weather> {
  const url = `${FORECAST}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const j = await getJson(url) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number }; timezone?: string };
  return { code: j.current?.weather_code ?? null, temp: j.current?.temperature_2m ?? null, isDay: j.current?.is_day === 1, timezone: j.timezone ?? null, source: 'open-meteo' };
}

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
// MET Norway's terms: keep each reading until its Expires time, then revalidate with If-Modified-Since
// (a 304 means the stored reading is still current). Coordinates are rounded to 2 decimals, so nearby
// requests share one entry.
type MetEntry = { data: Weather; expires: number; lastModified: string | null };
const metStore = new Map<string, MetEntry>();
function expiresFrom(h: Headers): number {
  const t = Date.parse(h.get('expires') ?? '');
  // No usable Expires: fall back to 30 minutes.
  return Number.isFinite(t) && t > Date.now() ? t : Date.now() + 30 * MINUTE;
}
export async function metWeather(lat: number, lon: number): Promise<Weather & { expires: number }> {
  const key = lat.toFixed(2) + ',' + lon.toFixed(2);
  const stored = metStore.get(key);
  if (stored && Date.now() < stored.expires) return { ...stored.data, expires: stored.expires };
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (stored?.lastModified) headers['If-Modified-Since'] = stored.lastModified;
  const r = await fetch(`${MET}?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, { signal: AbortSignal.timeout(6000), headers });
  if (r.status === 304 && stored) {
    stored.expires = expiresFrom(r.headers);
    stored.lastModified = r.headers.get('last-modified') ?? stored.lastModified;
    return { ...stored.data, expires: stored.expires };
  }
  if (!r.ok) {
    const ra = r.headers.get('retry-after');
    throw new UpstreamError('upstream ' + r.status + ' ' + (await r.text()).slice(0, 200), r.status, ra && /^\d+$/.test(ra) ? Number(ra) * 1000 : null);
  }
  const j = await r.json() as {
    properties?: { timeseries?: Array<{ data?: { instant?: { details?: { air_temperature?: number } }; next_1_hours?: { summary?: { symbol_code?: string } }; next_6_hours?: { summary?: { symbol_code?: string } } } }> };
  };
  const now = j.properties?.timeseries?.[0]?.data;
  const symbol = now?.next_1_hours?.summary?.symbol_code ?? now?.next_6_hours?.summary?.symbol_code;
  if (!symbol) throw new Error('MET: no symbol in response');
  const data: Weather = { code: metToWmo(symbol), temp: now?.instant?.details?.air_temperature ?? null, isDay: !/_night$/.test(symbol), timezone: null, source: 'met.no' };
  const entry = { data, expires: expiresFrom(r.headers), lastModified: r.headers.get('last-modified') };
  metStore.delete(key); metStore.set(key, entry);
  if (metStore.size > 2000) metStore.delete(metStore.keys().next().value as string);
  return { ...data, expires: entry.expires };
}

// ---------------- weather: cached for 30 minutes per ~10 km grid cell ----------------
// If every service is down, the last reading for that cell (up to 6 hours old) is served instead.
const weatherCache = new Map<string, { at: number; until: number; data: Weather }>();
const inflight = new Map<string, Promise<Weather & { expires?: number }>>();
async function lookupWeather(lat: number, lon: number): Promise<Weather & { expires?: number }> {
  try { return await openMeteo.call(() => openMeteoWeather(lat, lon)); } catch (first) {
    if (!openMeteo.coolingDown()) console.error('open-meteo weather failed:', (first as Error).message);
    return metNo.call(() => metWeather(lat, lon));
  }
}

world.get('/weather', requireUser, wrap(async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: 'Bad coordinates.' });
    return;
  }
  const key = lat.toFixed(1) + ',' + lon.toFixed(1);
  const hit = weatherCache.get(key);
  if (hit && Date.now() < hit.until) { res.json(hit.data); return; }
  try {
    // Requests for the same cell while a lookup is running share that one lookup.
    let pending = inflight.get(key);
    if (!pending) {
      pending = lookupWeather(lat, lon).finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    const { expires, ...data } = await pending;
    // Keep it 30 minutes, or longer if MET Norway says the reading is good for longer.
    const until = Math.max(Date.now() + 30 * MINUTE, expires ?? 0);
    weatherCache.delete(key);
    weatherCache.set(key, { at: Date.now(), until, data });
    if (weatherCache.size > 2000) weatherCache.delete(weatherCache.keys().next().value as string);
    res.json(data);
  } catch (err) {
    console.error('weather lookup failed:', (err as Error).message);
    if (hit && Date.now() - hit.at < 6 * 60 * MINUTE) { res.json({ ...hit.data, stale: true }); return; }
    res.status(502).json({ error: 'The weather spirits are quiet right now. Try again later.' });
  }
}));

world.get('/geocode', requireUser, wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q.length < 2) { res.status(400).json({ error: 'Type at least two letters.' }); return; }
  const round = (n: number) => Math.round(n * 1000) / 1000;
  try {
    let results;
    try {
      const j = await openMeteoGeo.call(() => getJson(`${GEOCODE}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`)) as {
        results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }>;
      };
      results = (j.results ?? []).map((r) => ({ name: r.name, country: r.country ?? '', region: r.admin1 ?? '', lat: round(r.latitude), lon: round(r.longitude) }));
    } catch (first) {
      if (!openMeteoGeo.coolingDown()) console.error('open-meteo geocode failed:', (first as Error).message);
      const j = await nominatim.call(() => getJson(`${NOMINATIM}?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&addressdetails=1&accept-language=en`)) as
        Array<{ name?: string; display_name: string; lat: string; lon: string; address?: { country?: string; state?: string; region?: string } }>;
      results = j.map((r) => ({
        name: r.name || r.display_name.split(',')[0], country: r.address?.country ?? '', region: r.address?.state ?? r.address?.region ?? '',
        lat: round(Number(r.lat)), lon: round(Number(r.lon))
      }));
    }
    res.json({ results });
  } catch (err) {
    console.error('geocode failed:', (err as Error).message);
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
