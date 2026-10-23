import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Put your Neon connection string in it (see README).');
}

// Neon requires TLS; a local Postgres usually does not. `sslmode=require` in the URL turns it on.
const needsSsl = /sslmode=require/.test(connectionString) || process.env.PGSSL === 'true';

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  max: 5,
  // Neon scales to zero; give the first connection time to wake the compute.
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});

// Idempotent schema setup, run on every start.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- One row per user: the game state the client needs to resume (gems, shards, solved, saved).
CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every submitted solution, with the answers typed into each Socratic question.
CREATE TABLE IF NOT EXISTS attempts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_title TEXT NOT NULL,
  problem_rank  INTEGER,
  family        TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  answers       JSONB NOT NULL,
  code          TEXT NOT NULL,
  first_clear   BOOLEAN NOT NULL,
  gems_earned   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_user_time_idx ON attempts(user_id, created_at DESC);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
}
