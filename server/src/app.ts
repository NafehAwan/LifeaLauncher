/**
 * Lifea backend. Auth: the client proves account ownership with its Minecraft access token, which is checked once
 * against api.minecraftservices.com and exchanged for our own short-lived JWT. Mojang tokens are never stored.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { migrate, seed, type Db } from './db.js';

export interface Options {
  db: Db;
  jwtSecret: string;
  publicUrl: string;
  allowOffline?: boolean;
  /** Override for tests: resolve a Minecraft access token to a profile. */
  verifyMinecraftToken?: (token: string) => Promise<{ id: string; name: string } | null>;
  logger?: boolean;
}

type Presence = { state: 'offline' | 'launcher' | 'playing'; server?: string; version?: string; since?: number };
const COSMETIC_TYPES = ['cape', 'wings', 'hat', 'bandana', 'pet', 'emote'] as const;
const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dash = (id: string) => {
  const h = id.replace(/-/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

async function mojangProfile(token: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; name: string };
}

export async function buildApp(opts: Options): Promise<FastifyInstance> {
  const { db } = opts;
  await migrate(db);
  await seed(db, opts.publicUrl.replace(/\/+$/, ''));
  const secret = new TextEncoder().encode(opts.jwtSecret);
  const verifyMc = opts.verifyMinecraftToken ?? mojangProfile;

  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024 });
  await app.register(cors, { origin: false });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });
  await app.register(fastifyStatic, { root: join(dirname(fileURLToPath(import.meta.url)), '..', 'assets'), prefix: '/static/', decorateReply: false });

  /* ---------- auth ---------- */
  const sign = (uuid: string, username: string) =>
    new SignJWT({ username }).setProtectedHeader({ alg: 'HS256' }).setSubject(uuid).setIssuedAt().setExpirationTime('12h').sign(secret);

  async function userFromToken(token: string | undefined): Promise<{ uuid: string; username: string } | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, secret);
      return payload.sub ? { uuid: payload.sub, username: String(payload.username) } : null;
    } catch {
      return null;
    }
  }

  const auth = async (req: FastifyRequest) => {
    const user = await userFromToken(req.headers.authorization?.replace(/^Bearer /, ''));
    if (!user) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    return user;
  };

  const upsertUser = (uuid: string, username: string) =>
    db.run(
      `INSERT INTO users (uuid, username, username_lc, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET username = excluded.username, username_lc = excluded.username_lc`,
      [uuid, username, username.toLowerCase(), Date.now()],
    );

  app.post('/auth/minecraft', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ accessToken: z.string().min(10).max(4000) }).parse(req.body);
    const profile = await verifyMc(body.accessToken);
    if (!profile) return reply.code(401).send({ error: 'Minecraft token was rejected' });
    const uuid = dash(profile.id);
    await upsertUser(uuid, profile.name);
    return { token: await sign(uuid, profile.name), uuid, username: profile.name };
  });

  app.post('/auth/offline', async (req, reply) => {
    if (!opts.allowOffline) return reply.code(403).send({ error: 'This server only accepts Microsoft accounts' });
    const body = z.object({ uuid: z.string().regex(UUID), username: z.string().regex(USERNAME) }).parse(req.body);
    await upsertUser(body.uuid.toLowerCase(), body.username);
    return { token: await sign(body.uuid.toLowerCase(), body.username), uuid: body.uuid.toLowerCase(), username: body.username };
  });

  /* ---------- realtime presence ---------- */
  const sockets = new Map<string, Set<WebSocket>>();
  const presence = new Map<string, Presence>();
  const send = (uuid: string, msg: unknown) => {
    for (const ws of sockets.get(uuid) ?? []) if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const friendIds = async (uuid: string) => (await db.all<{ b: string }>('SELECT b FROM friendships WHERE a = ?', [uuid])).map((r) => r.b);
  const broadcastPresence = async (uuid: string) => {
    const p = presence.get(uuid) ?? { state: 'offline' };
    for (const f of await friendIds(uuid)) send(f, { type: 'presence', uuid, presence: p });
  };

  app.get('/realtime', { websocket: true }, async (socket, req) => {
    const user = await userFromToken((req.query as { token?: string }).token);
    if (!user) return socket.close(4001, 'unauthorized');
    if (!sockets.has(user.uuid)) sockets.set(user.uuid, new Set());
    sockets.get(user.uuid)!.add(socket);
    presence.set(user.uuid, presence.get(user.uuid) ?? { state: 'launcher', since: Date.now() });
    void broadcastPresence(user.uuid);
    socket.on('message', async (raw: Buffer) => {
      let msg: { type?: string; presence?: Presence; to?: string; emote?: string; partyId?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'presence' && msg.presence) {
        const p = z.object({ state: z.enum(['launcher', 'playing']), server: z.string().max(255).optional(), version: z.string().max(64).optional(), since: z.number().optional() }).safeParse(msg.presence);
        if (!p.success) return;
        presence.set(user.uuid, p.data);
        await broadcastPresence(user.uuid);
      } else if (msg.type === 'emote' && typeof msg.emote === 'string') {
        // Emotes are shown to Lifea players on the same server.
        const server = presence.get(user.uuid)?.server;
        if (!server) return;
        for (const [uuid, pr] of presence) if (uuid !== user.uuid && pr.server === server) send(uuid, { type: 'emote', uuid: user.uuid, emote: msg.emote.slice(0, 64) });
      } else if (msg.type === 'party-invite' && typeof msg.to === 'string') {
        if ((await friendIds(user.uuid)).includes(msg.to)) send(msg.to, { type: 'party-invite', from: user, partyId: msg.partyId ?? randomUUID() });
      }
    });
    socket.on('close', () => {
      const set = sockets.get(user.uuid);
      set?.delete(socket);
      if (!set?.size) {
        sockets.delete(user.uuid);
        presence.set(user.uuid, { state: 'offline' });
        void broadcastPresence(user.uuid);
      }
    });
  });

  /* ---------- friends ---------- */
  app.get('/friends', async (req) => {
    const me = await auth(req);
    const rows = await db.all<{ uuid: string; username: string }>('SELECT u.uuid, u.username FROM friendships f JOIN users u ON u.uuid = f.b WHERE f.a = ? ORDER BY u.username_lc', [me.uuid]);
    return rows.map((r) => ({ ...r, presence: presence.get(r.uuid) ?? { state: 'offline' } }));
  });

  app.get('/friends/requests', async (req) => {
    const me = await auth(req);
    const rows = await db.all<{ id: string; from_uuid: string; to_uuid: string; created_at: number; from_name: string; to_name: string }>(
      `SELECT r.id, r.from_uuid, r.to_uuid, r.created_at, fu.username AS from_name, tu.username AS to_name
       FROM friend_requests r JOIN users fu ON fu.uuid = r.from_uuid JOIN users tu ON tu.uuid = r.to_uuid
       WHERE r.from_uuid = ? OR r.to_uuid = ? ORDER BY r.created_at DESC`,
      [me.uuid, me.uuid],
    );
    return rows.map((r) => ({ id: r.id, from: { uuid: r.from_uuid, username: r.from_name }, to: { uuid: r.to_uuid, username: r.to_name }, createdAt: Number(r.created_at), incoming: r.to_uuid === me.uuid }));
  });

  app.post('/friends/requests', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const me = await auth(req);
    const { username } = z.object({ username: z.string().regex(USERNAME) }).parse(req.body);
    const target = await db.get<{ uuid: string }>('SELECT uuid FROM users WHERE username_lc = ?', [username.toLowerCase()]);
    if (!target) return reply.code(404).send({ error: `${username} has not used Lifea yet` });
    if (target.uuid === me.uuid) return reply.code(400).send({ error: 'You cannot add yourself' });
    if (await db.get('SELECT 1 FROM friendships WHERE a = ? AND b = ?', [me.uuid, target.uuid])) return reply.code(409).send({ error: 'Already friends' });
    // If they already asked us, accept instead of creating a second request.
    const reverse = await db.get<{ id: string }>('SELECT id FROM friend_requests WHERE from_uuid = ? AND to_uuid = ?', [target.uuid, me.uuid]);
    if (reverse) {
      await befriend(me.uuid, target.uuid, reverse.id);
      return { ok: true, accepted: true };
    }
    await db.run('INSERT INTO friend_requests (id, from_uuid, to_uuid, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', [randomUUID(), me.uuid, target.uuid, Date.now()]);
    send(target.uuid, { type: 'friends-changed' });
    return { ok: true };
  });

  async function befriend(a: string, b: string, requestId: string) {
    const now = Date.now();
    await db.run('INSERT INTO friendships (a, b, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [a, b, now]);
    await db.run('INSERT INTO friendships (a, b, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [b, a, now]);
    await db.run('DELETE FROM friend_requests WHERE id = ?', [requestId]);
    send(a, { type: 'friends-changed' });
    send(b, { type: 'friends-changed' });
  }

  app.post('/friends/requests/:id/:action', async (req, reply) => {
    const me = await auth(req);
    const { id, action } = z.object({ id: z.string().max(64), action: z.enum(['accept', 'decline']) }).parse(req.params);
    const r = await db.get<{ id: string; from_uuid: string; to_uuid: string }>('SELECT * FROM friend_requests WHERE id = ?', [id]);
    if (!r || (r.to_uuid !== me.uuid && r.from_uuid !== me.uuid)) return reply.code(404).send({ error: 'Request not found' });
    if (action === 'accept') {
      if (r.to_uuid !== me.uuid) return reply.code(403).send({ error: 'Only the recipient can accept' });
      await befriend(r.from_uuid, r.to_uuid, r.id);
    } else {
      await db.run('DELETE FROM friend_requests WHERE id = ?', [id]);
      send(r.from_uuid === me.uuid ? r.to_uuid : r.from_uuid, { type: 'friends-changed' });
    }
    return { ok: true };
  });

  app.delete('/friends/:uuid', async (req) => {
    const me = await auth(req);
    const { uuid } = z.object({ uuid: z.string().regex(UUID) }).parse(req.params);
    await db.run('DELETE FROM friendships WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', [me.uuid, uuid, uuid, me.uuid]);
    send(uuid, { type: 'friends-changed' });
    return { ok: true };
  });

  /* ---------- messages ---------- */
  app.get('/messages/:uuid', async (req) => {
    const me = await auth(req);
    const { uuid } = z.object({ uuid: z.string().regex(UUID) }).parse(req.params);
    const rows = await db.all<{ id: string; from_uuid: string; to_uuid: string; body: string; sent_at: number }>(
      `SELECT * FROM messages WHERE (from_uuid = ? AND to_uuid = ?) OR (from_uuid = ? AND to_uuid = ?) ORDER BY sent_at DESC LIMIT 200`,
      [me.uuid, uuid, uuid, me.uuid],
    );
    return rows.reverse().map((m) => ({ id: m.id, from: m.from_uuid, to: m.to_uuid, body: m.body, sentAt: Number(m.sent_at) }));
  });

  app.post('/messages/:uuid', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const me = await auth(req);
    const { uuid } = z.object({ uuid: z.string().regex(UUID) }).parse(req.params);
    const { body } = z.object({ body: z.string().trim().min(1).max(1000) }).parse(req.body);
    if (!(await db.get('SELECT 1 FROM friendships WHERE a = ? AND b = ?', [me.uuid, uuid]))) return reply.code(403).send({ error: 'You can only message friends' });
    const msg = { id: randomUUID(), from: me.uuid, to: uuid, body, sentAt: Date.now() };
    await db.run('INSERT INTO messages (id, from_uuid, to_uuid, body, sent_at) VALUES (?, ?, ?, ?, ?)', [msg.id, msg.from, msg.to, msg.body, msg.sentAt]);
    send(uuid, { type: 'message', message: msg });
    return msg;
  });

  /* ---------- cosmetics ---------- */
  app.get('/cosmetics/catalog', async () => db.all('SELECT id, name, type, texture, preview, rarity FROM cosmetics ORDER BY type, name'));

  const equippedFor = async (uuid: string) => Object.fromEntries((await db.all<{ type: string; cosmetic_id: string }>('SELECT type, cosmetic_id FROM equipped WHERE uuid = ?', [uuid])).map((r) => [r.type, r.cosmetic_id]));

  app.get('/me/cosmetics', async (req) => equippedFor((await auth(req)).uuid));

  app.put('/me/cosmetics', async (req, reply) => {
    const me = await auth(req);
    const { type, id } = z.object({ type: z.enum(COSMETIC_TYPES), id: z.string().max(64).nullable() }).parse(req.body);
    if (id === null) await db.run('DELETE FROM equipped WHERE uuid = ? AND type = ?', [me.uuid, type]);
    else {
      const item = await db.get<{ type: string }>('SELECT type FROM cosmetics WHERE id = ?', [id]);
      if (!item || item.type !== type) return reply.code(400).send({ error: 'Unknown cosmetic' });
      await db.run('INSERT INTO equipped (uuid, type, cosmetic_id) VALUES (?, ?, ?) ON CONFLICT (uuid, type) DO UPDATE SET cosmetic_id = excluded.cosmetic_id', [me.uuid, type, id]);
    }
    return equippedFor(me.uuid);
  });

  /** Public batch lookup used by lifea-core to render other players' cosmetics. */
  app.post('/cosmetics/lookup', async (req) => {
    const { uuids } = z.object({ uuids: z.array(z.string().regex(UUID)).max(100) }).parse(req.body);
    if (!uuids.length) return {};
    const rows = await db.all<{ uuid: string; type: string; texture: string; cosmetic_id: string }>(
      `SELECT e.uuid, e.type, e.cosmetic_id, c.texture FROM equipped e JOIN cosmetics c ON c.id = e.cosmetic_id WHERE e.uuid IN (${uuids.map(() => '?').join(',')})`,
      uuids.map((u) => u.toLowerCase()),
    );
    const out: Record<string, Record<string, { id: string; texture: string }>> = {};
    for (const r of rows) (out[r.uuid] ??= {})[r.type] = { id: r.cosmetic_id, texture: r.texture };
    return out;
  });

  /* ---------- content ---------- */
  app.get('/news', async () => db.all('SELECT id, title, body, image, url, date FROM news ORDER BY date DESC LIMIT 10'));
  app.get('/featured-servers', async () => db.all('SELECT id, name, address, description FROM featured_servers ORDER BY sort LIMIT 10'));
  app.get('/health', async () => ({ ok: true, db: db.kind }));

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Invalid request', issues: e.issues.map((i) => i.message) });
    const code = e.statusCode ?? 500;
    if (code >= 500) app.log.error(err);
    return reply.code(code).send({ error: code >= 500 ? 'Internal error' : e.message });
  });

  return app;
}
