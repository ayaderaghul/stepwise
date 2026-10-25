// Calls to outside services, following each one's terms:
// - Open-Meteo (weather, place search): free for non-commercial use, under 10,000 calls a day per IP; CC BY 4.0.
// - MET Norway: identify with a User-Agent and website; at most 4 decimals in coordinates; never ask again before
//   the Expires time; revalidate with If-Modified-Since set to the previous Last-Modified; HTTPS; CC BY 4.0.
// - OpenStreetMap Nominatim: at most 1 request a second, identifying User-Agent, cache results, no autocomplete
//   (we search only when the explorer presses FIND); data © OpenStreetMap contributors, ODbL.
// Every service also gets its own pause after a failure (see Polite), stored in Postgres so it survives restarts.
import { pool } from './db.js';

export const UA = 'stepwise-app/1.0 (+https://stepwise-app-izre.onrender.com)';
export const MINUTE = 60 * 1000;

export class UpstreamError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null) { super(message); }
}
function retryAfter(h: Headers): number | null {
  const ra = h.get('retry-after');
  if (!ra) return null;
  const ms = /^\d+$/.test(ra) ? Number(ra) * 1000 : Date.parse(ra) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export type Fetched = { status: number; body: unknown; headers: Headers };
// One HTTP GET. `ifModifiedSince` turns it into a conditional request (a 304 comes back with body null).
export async function fetchJson(url: string, ifModifiedSince?: string | null): Promise<Fetched> {
  const headers: Record<string, string> = { 'User-Agent': UA, 'Accept': 'application/json' };
  if (ifModifiedSince) headers['If-Modified-Since'] = ifModifiedSince;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers });
  if (r.status === 304) return { status: 304, body: null, headers: r.headers };
  if (!r.ok) throw new UpstreamError('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160), r.status, retryAfter(r.headers));
  return { status: r.status, body: await r.json(), headers: r.headers };
}

// ---------------- pauses ----------------
// After a failure the service is not called again until the pause ends:
// - a daily-quota refusal waits until just after the next UTC midnight (when Open-Meteo resets);
// - a Retry-After header is obeyed, up to a day;
// - 403 (we are blocked) waits an hour, and the page says "you are blocked";
// - server errors, timeouts and network failures back off 1, 2, 4 … up to 60 minutes;
// - 400 and 404 are about that one request, so they do not pause the service.
// Calls to one service go out one at a time, at least `minGapMs` apart.
export class Polite {
  private until = 0;
  private failures = 0;
  private lastStatus: number | null = null;
  private last = 0;
  private queue: Promise<unknown> = Promise.resolve();
  static all: Polite[] = [];
  constructor(readonly name: string, readonly label: string, private readonly minGapMs = 0) { Polite.all.push(this); }

  paused() { return Date.now() < this.until; }
  minutesLeft() { return Math.max(1, Math.ceil((this.until - Date.now()) / MINUTE)); }
  // Shown on the page while this service has blocked us.
  blockedNotice(): string | null {
    return this.paused() && this.lastStatus === 403
      ? `${this.label}: you are blocked (HTTP 403). Stepwise stopped calling it for ${this.minutesLeft()} min.` : null;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const resting = () => new Error(`${this.name}: paused for ${this.minutesLeft()} more min`);
    if (this.paused()) throw resting();
    const run = async () => {
      if (this.paused()) throw resting(); // a call queued behind one that just failed must not go out
      const wait = this.last + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      try {
        const out = await fn();
        if (this.failures || this.lastStatus) { this.failures = 0; this.lastStatus = null; void this.save(null); }
        return out;
      } catch (err) {
        this.trip(err);
        throw err;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private trip(err: unknown) {
    const e = err as Partial<UpstreamError> & Error;
    const status = typeof e.status === 'number' ? e.status : null;
    if (status === 400 || status === 404) return;
    this.failures += 1;
    this.lastStatus = status;
    let ms: number;
    if (status === 429 && /daily|per day|tomorrow/i.test(e.message)) {
      const d = new Date(); d.setUTCHours(24, 5, 0, 0); ms = d.getTime() - Date.now();
    } else if (e.retryAfterMs) ms = Math.min(e.retryAfterMs, 24 * 60 * MINUTE);
    else if (status === 403) ms = 60 * MINUTE;
    else ms = Math.min(MINUTE * 2 ** (this.failures - 1), 60 * MINUTE);
    this.until = Date.now() + ms;
    console.error(`${this.name} failed (${e.message}); pausing calls for ${Math.round(ms / MINUTE)} min`);
    void this.save(e.message);
  }

  private async save(reason: string | null) {
    try {
      await pool.query(
        `INSERT INTO outside_pause (service, paused_until, failures, last_status, reason, updated_at)
         VALUES ($1, to_timestamp($2 / 1000.0), $3, $4, $5, now())
         ON CONFLICT (service) DO UPDATE SET paused_until = EXCLUDED.paused_until, failures = EXCLUDED.failures,
           last_status = EXCLUDED.last_status, reason = EXCLUDED.reason, updated_at = now()`,
        [this.name, this.until, this.failures, this.lastStatus, reason?.slice(0, 300) ?? null],
      );
    } catch (err) { console.error('could not save pause for', this.name, (err as Error).message); }
  }

  // Called once at start-up so a restart does not forget an active pause.
  static async loadAll() {
    const { rows } = await pool.query('SELECT service, paused_until, failures, last_status FROM outside_pause');
    for (const r of rows) {
      const p = Polite.all.find((x) => x.name === r.service);
      if (!p) continue;
      p.until = new Date(r.paused_until).getTime();
      p.failures = r.failures;
      p.lastStatus = r.last_status;
      if (p.paused()) console.log(`${p.name} still paused for ${p.minutesLeft()} min (from before the restart)`);
    }
  }
}

// ---------------- the cache (Postgres, with a small in-memory copy in front) ----------------
export type CacheRow = { body: unknown; expiresAt: number; lastModified: string | null; fetchedAt: number };
const memory = new Map<string, CacheRow>();

export async function cacheGet(key: string): Promise<CacheRow | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const { rows } = await pool.query('SELECT body, expires_at, last_modified, fetched_at FROM outside_cache WHERE key = $1', [key]);
    if (!rows[0]) return null;
    const row = { body: rows[0].body, expiresAt: new Date(rows[0].expires_at).getTime(), lastModified: rows[0].last_modified, fetchedAt: new Date(rows[0].fetched_at).getTime() };
    remember(key, row);
    return row;
  } catch (err) { console.error('cache read failed:', (err as Error).message); return null; }
}
export async function cachePut(key: string, body: unknown, expiresAt: number, lastModified: string | null = null, fetchedAt = Date.now()) {
  const row = { body, expiresAt, lastModified, fetchedAt };
  remember(key, row);
  try {
    await pool.query(
      `INSERT INTO outside_cache (key, body, expires_at, last_modified, fetched_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0), $4, to_timestamp($5 / 1000.0))
       ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, expires_at = EXCLUDED.expires_at,
         last_modified = EXCLUDED.last_modified, fetched_at = EXCLUDED.fetched_at`,
      [key, JSON.stringify(body), expiresAt, lastModified, fetchedAt],
    );
  } catch (err) { console.error('cache write failed:', (err as Error).message); }
}
function remember(key: string, row: CacheRow) {
  memory.delete(key); memory.set(key, row);
  if (memory.size > 3000) memory.delete(memory.keys().next().value as string);
}
// The Expires header as a time; without a usable one, `fallbackMs` from now.
export function expiresFrom(h: Headers, fallbackMs: number): number {
  const t = Date.parse(h.get('expires') ?? '');
  return Number.isFinite(t) && t > Date.now() ? t : Date.now() + fallbackMs;
}
