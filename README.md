# Stepwise

Socratic, 8-bit LeetCode practice, styled as a jungle expedition. Scroll the Taro 75 like a social feed
(the Trail); each post is one temple.
Opening a post walks you through guiding questions — you type an answer before each reveal — then you
write the code and get a review. Clearing problems earns gems that unlock the next topics.
Progress and every attempt are saved to your account, so they follow you across devices.

## Features

- **Feed**: the Taro 75 in ranking order, plus three bonus quests (Max Depth of Binary Tree, Implement Trie, Range Sum Query).
- **Quests**: three or four Socratic questions per problem, each with an optional hint and an "another angle" reveal.
- **Gems**: one family per problem (chosen by the key idea it teaches), 12 common gems and 2 animated rare gems.
- **Unlocks**: family prerequisites, quest prerequisites (Two Sum → 3Sum, LRU → LFU…), mixed gem requirements, and Easy → Medium → Hard tiers.
- **Shards**: secondary topic tags drop shards; five shards fuse into a gem.
- **Accounts**: username + password; sign-up needs an invite code.
- **Jungle theme**: original pixel sprites (toucan hints, temple guardians, vines), Elder Futhark runes, and
  8-bit sounds synthesized with the Web Audio API (mute and ambience toggles in the Journal).
- **Daily surprises**:
  - *Daily rune*: one of 24 runes a day, with a coding saying and a one-day shard blessing; collected on the Runestone.
  - *Wild encounters*: about 1 in 3 first clears — toucan (free shard), jaguar (no-hint dare, double gems),
    frog (riddle from a solved problem), monkey (practice peek at a sealed temple). Encounters never take gems.
  - *Overgrown ruins*: solved problems return after 1, 3, 7, 14 and 30 days for a from-memory answer (spaced review).
  - *Live weather*: the real sky over your chosen city (Open-Meteo) sets the jungle weather — sunshine (+10% gold),
    monsoon (double shards), thunder (more encounters), stone rain on hail (three volcanic stones, 5 gold each),
    murmuring mist on fog (more curiosities), frost on snow or below 0° (ruins pay double).
  - *Moon events*: the phase is computed from the date. Full moon: a wolf in one region gives moonstone shards.
    New moon: fairies appear on trail markers and in atlas regions with a technique hint and a proverb
    (kept in the satchel), and rune blessings count twice.
- **Atlas**: the 78 temples in 13 regions, lowlands (hashing) up to the crystal spires (rare gems). Huts, shrines and
  ziggurats by difficulty; the hardest temples sit behind a sealed gate that demands gems of their own region.
  Each reached region has a few curiosities a day: runestones (a saying), murmuring land and animals (shards),
  and totems (a from-memory challenge).
- **Gold and the Hall of Explorers**: gems convert to gold by how much mental energy the topic takes
  (hashing 10 … linked list 20 … DP 32, trie 60, segment tree 80; a shard is a fifth). Ranks with their own gear,
  from Wanderer to Temple Monarch. Every account appears on the leaderboard automatically (all-time and this week).
- **Log**: day streak, a 30-day activity grid, and every attempt with your answers and code.

- **Boss stage**: your TypeScript runs against real tests. Finishing the quests pays part of the gems; the rest,
  plus shards and unlocks, only when every test passes. Failures show the input, expected and actual output.

The written reviewer notes are still fixed per problem (AI review is a planned next step).

## How the tests run

1. The server strips TypeScript types with the TypeScript compiler (`POST /api/transpile`). It never runs your code.
2. The browser runs the code in a Web Worker (`public/runner.js`). That file is served with a CSP that allows
   `eval` but no network, and fetch/XHR/WebSocket are removed before your code runs.
3. Each test case has a 3-second limit; the page kills the worker if it is exceeded.

Tests live in `tests-src/problems.mjs` as inputs plus a reference solution. `npm run tests:build` runs every
reference solution to compute the expected outputs, checks each reference passes its own comparator, and writes
`public/tests.js` (372 cases across 78 problems). Comparators handle any-order answers, floats, in-place edits,
linked lists, trees, design classes, and problems with several valid answers.

## Stack

- **Server**: Node 20+, TypeScript, Express, `pg` (`server/`).
- **Database**: Postgres — [Neon](https://neon.com) in production. Tables are created on start-up.
- **Frontend**: plain HTML/CSS/JS with no build step (`public/`).

| Path | What it holds |
| --- | --- |
| `server/index.ts` | HTTP server, security headers, static files |
| `server/routes.ts` | JSON API: auth, progress, attempts, stats |
| `server/auth.ts` | scrypt password hashing, session cookies (only token hashes are stored) |
| `server/db.ts` | Connection pool and schema |
| `public/logic.js` | Problems, gems, unlock rules and game state |
| `public/app.js` | Rendering, sign-in, sync, log screens |

## API

| Method | Path | |
| --- | --- | --- |
| POST | `/api/signup` | `{ username, password, invite }` |
| POST | `/api/login` / `/api/logout` | |
| GET | `/api/me` | current user |
| GET / PUT | `/api/progress` | `{ state: { solved, gems, shards, saved, place, bonusGold, … } }` |
| POST | `/api/attempts` | `{ title, rank, family, difficulty, answers[], code, firstClear, gemsEarned }` |
| GET | `/api/attempts`, `/api/attempts/:id` | history and one attempt |
| GET | `/api/stats?tz=Europe/Rome` | streak, best streak, last 30 days |
| GET | `/api/weather?lat=&lon=` | current weather code and temperature (Open-Meteo, else MET Norway; cached 30 min) |
| GET | `/api/geocode?q=` | city search for the weather location |
| GET | `/api/leaderboard?period=all\|week` | every explorer's gold, rank and weekly gold |

## Calling outside services politely

Weather and city search go to Open-Meteo first, then MET Norway (weather) or OpenStreetMap Nominatim (search).
Each service has its own cool-down in `server/world.ts`: a daily-quota refusal pauses it until just after UTC
midnight, `Retry-After` is obeyed, a 403 pauses it for an hour, and other failures back off 1, 2, 4 … 60 minutes.
Calls to one service run one at a time (Nominatim at most one per second), lookups for the same place share one
request, and if every service is down the last reading for that place (up to 6 hours old) is served.

## Environment

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon's includes `sslmode=require`) |
| `INVITE_CODE` | Required to create an account. If unset, only the first account can be created. |
| `NODE_ENV` | `production` makes the session cookie `Secure` |
| `PORT` | Set by Render |
| `OPEN_METEO_FORECAST`, `OPEN_METEO_GEOCODE` | Optional overrides of the Open-Meteo endpoints (for tests) |

## Run locally

```bash
npm install
DATABASE_URL=postgres://localhost:5432/stepwise INVITE_CODE=dev npm run dev
# open http://localhost:3000
```

## Deploy (Render + Neon)

Render web service: build `npm ci && npm run build`, start `npm start`, health check `/healthz`,
with `DATABASE_URL` and `INVITE_CODE` set (see `render.yaml`).
On Render's free plan the service sleeps after 15 idle minutes, so the first visit after a break takes up to a minute.

Problem list and order from [Taro 75](https://www.jointaro.com/interviews/taro-75). Prompts and quests are original wording.
