import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { openSqlite } from '../src/db.js';

const ALICE = { id: '11111111111141118111111111111111', name: 'Alice' };
const BOB = { id: '22222222222242228222222222222222', name: 'Bob_2' };
const dash = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

let app: FastifyInstance;
let base = '';
const tokens: Record<string, string> = {};

async function call<T = unknown>(method: string, url: string, who?: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await app.inject({ method: method as 'GET', url, headers: who ? { authorization: `Bearer ${tokens[who]}` } : {}, payload: body as object });
  return { status: res.statusCode, json: (res.body ? JSON.parse(res.body) : undefined) as T };
}

beforeAll(async () => {
  app = await buildApp({
    db: openSqlite(':memory:'),
    jwtSecret: 'x'.repeat(40),
    publicUrl: 'http://localhost',
    verifyMinecraftToken: async (t) => (t === 'mc-token-alice-0000' ? ALICE : t === 'mc-token-bob-00000' ? BOB : null),
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = typeof addr === 'object' && addr ? `127.0.0.1:${addr.port}` : '';
  for (const [who, t] of [['alice', 'mc-token-alice-0000'], ['bob', 'mc-token-bob-00000']]) {
    const r = await call<{ token: string }>('POST', '/auth/minecraft', undefined, { accessToken: t });
    tokens[who] = r.json.token;
  }
});
afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('rejects bad Minecraft tokens and offline logins by default', async () => {
    expect((await call('POST', '/auth/minecraft', undefined, { accessToken: 'not-a-real-token' })).status).toBe(401);
    expect((await call('POST', '/auth/offline', undefined, { uuid: dash(ALICE.id), username: 'Alice' })).status).toBe(403);
  });
  it('protects private routes', async () => {
    expect((await call('GET', '/friends')).status).toBe(401);
  });
});

describe('friends, messages and presence', () => {
  it('runs the full request → accept → message flow with realtime events', async () => {
    const aliceUuid = dash(ALICE.id);
    const bobUuid = dash(BOB.id);
    const bobWs = new WebSocket(`ws://${base}/realtime?token=${tokens.bob}`);
    const events: { type: string; [k: string]: unknown }[] = [];
    bobWs.on('message', (m) => events.push(JSON.parse(String(m))));
    await new Promise((r) => bobWs.once('open', r));

    expect((await call('POST', '/friends/requests', 'alice', { username: 'nobody_here' })).status).toBe(404);
    expect((await call('POST', '/friends/requests', 'alice', { username: 'alice' })).status).toBe(400);
    expect((await call('POST', '/friends/requests', 'alice', { username: 'bob_2' })).status).toBe(200);
    const reqs = await call<{ id: string; incoming: boolean }[]>('GET', '/friends/requests', 'bob');
    expect(reqs.json).toHaveLength(1);
    expect(reqs.json[0].incoming).toBe(true);
    expect((await call('POST', `/friends/requests/${reqs.json[0].id}/accept`, 'alice')).status).toBe(403);
    expect((await call('POST', `/friends/requests/${reqs.json[0].id}/accept`, 'bob')).status).toBe(200);

    const friends = await call<{ uuid: string; presence: { state: string } }[]>('GET', '/friends', 'alice');
    expect(friends.json.map((f) => f.uuid)).toEqual([bobUuid]);
    expect(friends.json[0].presence.state).toBe('launcher');

    const aliceWs = new WebSocket(`ws://${base}/realtime?token=${tokens.alice}`);
    await new Promise((r) => aliceWs.once('open', r));
    aliceWs.send(JSON.stringify({ type: 'presence', presence: { state: 'playing', server: 'play.example.net', version: '1.21.4' } }));
    const sent = await call<{ id: string }>('POST', `/messages/${bobUuid}`, 'alice', { body: 'gg!' });
    expect(sent.status).toBe(200);
    await new Promise((r) => setTimeout(r, 150));
    expect(events.some((e) => e.type === 'friends-changed')).toBe(true);
    expect(events.some((e) => e.type === 'presence' && (e.presence as { server?: string }).server === 'play.example.net')).toBe(true);
    expect(events.some((e) => e.type === 'message' && (e.message as { body: string }).body === 'gg!')).toBe(true);

    const history = await call<{ body: string; from: string }[]>('GET', `/messages/${aliceUuid}`, 'bob');
    expect(history.json).toEqual([expect.objectContaining({ body: 'gg!', from: aliceUuid })]);

    aliceWs.close();
    bobWs.close();
  });

  it('only friends can message', async () => {
    expect((await call('POST', `/messages/${dash('33333333333343338333333333333333')}`, 'alice', { body: 'hi' })).status).toBe(403);
  });
});

describe('cosmetics', () => {
  it('serves a catalog, equips, and answers batch lookups', async () => {
    const catalog = await call<{ id: string; type: string; texture: string }[]>('GET', '/cosmetics/catalog');
    expect(catalog.json.length).toBeGreaterThan(5);
    expect((await call('PUT', '/me/cosmetics', 'alice', { type: 'wings', id: 'cape-crimson' })).status).toBe(400);
    const eq = await call<Record<string, string>>('PUT', '/me/cosmetics', 'alice', { type: 'cape', id: 'cape-ember' });
    expect(eq.json).toEqual({ cape: 'cape-ember' });
    const lookup = await call<Record<string, Record<string, { id: string; texture: string }>>>('POST', '/cosmetics/lookup', undefined, { uuids: [dash(ALICE.id), dash(BOB.id)] });
    expect(lookup.json[dash(ALICE.id)].cape.id).toBe('cape-ember');
    expect(lookup.json[dash(BOB.id)]).toBeUndefined();
    const tex = await app.inject({ method: 'GET', url: '/static/cosmetics/cape-ember.png' });
    expect(tex.statusCode).toBe(200);
    expect(tex.headers['content-type']).toContain('image/png');
  });
  it('validates input', async () => {
    expect((await call('POST', '/cosmetics/lookup', undefined, { uuids: ['nope'] })).status).toBe(400);
  });
});

describe('content', () => {
  it('has news and health', async () => {
    expect((await call<unknown[]>('GET', '/news')).json.length).toBeGreaterThan(0);
    expect((await call<{ ok: boolean }>('GET', '/health')).json.ok).toBe(true);
  });
});
