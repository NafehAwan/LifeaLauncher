/**
 * Tiny SQL layer with two backends: PostgreSQL (DATABASE_URL) for production and node:sqlite for dev/tests.
 * Queries use `?` placeholders; they are rewritten to `$1…` for Postgres.
 */
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';
import pg from 'pg';

// Loaded via require so bundlers/test runners that don't know the newer `node:sqlite` builtin leave it alone.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncT };
export interface Db {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<number>;
  close(): Promise<void>;
  kind: 'sqlite' | 'postgres';
}

const toPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export function openSqlite(file = ':memory:'): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const norm = (p: unknown[]) => p.map((v) => (typeof v === 'boolean' ? Number(v) : v ?? null)) as (string | number | null)[];
  return {
    kind: 'sqlite',
    all: async <T>(sql: string, p: unknown[] = []) => db.prepare(sql).all(...norm(p)) as T[],
    get: async <T>(sql: string, p: unknown[] = []) => db.prepare(sql).get(...norm(p)) as T | undefined,
    run: async (sql: string, p: unknown[] = []) => Number(db.prepare(sql).run(...norm(p)).changes),
    close: async () => db.close(),
  };
}

export function openPostgres(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    kind: 'postgres',
    all: async <T>(sql: string, p: unknown[] = []) => (await pool.query(toPg(sql), p)).rows as T[],
    get: async <T>(sql: string, p: unknown[] = []) => (await pool.query(toPg(sql), p)).rows[0] as T | undefined,
    run: async (sql: string, p: unknown[] = []) => (await pool.query(toPg(sql), p)).rowCount ?? 0,
    close: async () => pool.end(),
  };
}

/** Portable schema (TEXT + BIGINT timestamps work the same on both engines). */
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (uuid TEXT PRIMARY KEY, username TEXT NOT NULL, username_lc TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS users_username ON users (username_lc)`,
  `CREATE TABLE IF NOT EXISTS friend_requests (id TEXT PRIMARY KEY, from_uuid TEXT NOT NULL, to_uuid TEXT NOT NULL, created_at BIGINT NOT NULL, UNIQUE (from_uuid, to_uuid))`,
  `CREATE TABLE IF NOT EXISTS friendships (a TEXT NOT NULL, b TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (a, b))`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, from_uuid TEXT NOT NULL, to_uuid TEXT NOT NULL, body TEXT NOT NULL, sent_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS messages_pair ON messages (from_uuid, to_uuid, sent_at)`,
  `CREATE TABLE IF NOT EXISTS cosmetics (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, texture TEXT NOT NULL, preview TEXT, rarity TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS equipped (uuid TEXT NOT NULL, type TEXT NOT NULL, cosmetic_id TEXT NOT NULL, PRIMARY KEY (uuid, type))`,
  `CREATE TABLE IF NOT EXISTS news (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, image TEXT, url TEXT, date TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS featured_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, description TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0)`,
];

export async function migrate(db: Db): Promise<void> {
  for (const m of MIGRATIONS) await db.run(m);
}

/** Seed the original Lifea cosmetics (textures live in assets/cosmetics) and a welcome news post. */
export async function seed(db: Db, publicUrl: string): Promise<void> {
  const tex = (f: string) => `${publicUrl}/static/cosmetics/${f}`;
  const items: [string, string, string, string, string][] = [
    ['cape-crimson', 'Crimson Cape', 'cape', 'cape-crimson.png', 'common'],
    ['cape-ember', 'Ember Cape', 'cape', 'cape-ember.png', 'rare'],
    ['cape-bloodmoon', 'Blood Moon Cape', 'cape', 'cape-bloodmoon.png', 'epic'],
    ['cape-lifea', 'Lifea Founder Cape', 'cape', 'cape-lifea.png', 'legendary'],
    ['wings-ember', 'Ember Wings', 'wings', 'wings-ember.png', 'epic'],
    ['hat-crown', 'Crimson Crown', 'hat', 'hat-crown.png', 'legendary'],
    ['bandana-red', 'Red Bandana', 'bandana', 'bandana-red.png', 'common'],
    ['emote-wave', 'Wave', 'emote', 'emote-wave.png', 'common'],
    ['emote-dance', 'Dance', 'emote', 'emote-dance.png', 'rare'],
  ];
  for (const [id, name, type, file, rarity] of items) {
    await db.run(
      `INSERT INTO cosmetics (id, name, type, texture, preview, rarity) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, texture = excluded.texture, preview = excluded.preview, rarity = excluded.rarity`,
      [id, name, type, tex(file), tex(file), rarity],
    );
  }
  await db.run(
    `INSERT INTO news (id, title, body, url, date) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    ['welcome', 'Welcome to Lifea', 'Friends, cosmetics and one-click performance are live. Press Right-Shift in game to open the Lifea menu.', null, new Date().toISOString()],
  );
}
