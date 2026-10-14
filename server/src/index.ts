import { mkdirSync } from 'node:fs';
import { buildApp } from './app.js';
import { openPostgres, openSqlite } from './db.js';

const port = Number(process.env.PORT ?? 8787);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('Set JWT_SECRET to a random string of at least 32 characters.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) mkdirSync('data', { recursive: true });
const db = process.env.DATABASE_URL ? openPostgres(process.env.DATABASE_URL) : openSqlite(process.env.SQLITE_FILE ?? 'data/lifea.db');
const app = await buildApp({
  db,
  jwtSecret,
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
  allowOffline: process.env.ALLOW_OFFLINE === '1',
  logger: true,
});
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port });
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}
