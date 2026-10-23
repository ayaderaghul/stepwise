# Stepwise

Socratic, 8-bit LeetCode practice. Scroll the Taro 75 like a social feed; each post is one problem.
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
| GET / PUT | `/api/progress` | `{ state: { solved, gems, shards, saved, fresh } }` |
| POST | `/api/attempts` | `{ title, rank, family, difficulty, answers[], code, firstClear, gemsEarned }` |
| GET | `/api/attempts`, `/api/attempts/:id` | history and one attempt |
| GET | `/api/stats?tz=Europe/Rome` | streak, best streak, last 30 days |

## Environment

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon's includes `sslmode=require`) |
| `INVITE_CODE` | Required to create an account. If unset, only the first account can be created. |
| `NODE_ENV` | `production` makes the session cookie `Secure` |
| `PORT` | Set by Render |

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
