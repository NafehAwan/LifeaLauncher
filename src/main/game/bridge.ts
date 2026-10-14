/**
 * Local bridge between the launcher and the lifea-core mod: a WebSocket on 127.0.0.1 guarded by a per-session token.
 * The mod reports FPS stats, presence and screenshots; the launcher hands it the backend URL and a social token.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { FpsStats } from '@shared/types';
import { readJson, writeJsonAtomic } from '../core/fsx';
import { instanceDir } from '../core/paths';
import { log } from '../core/log';

let server: WebSocketServer | null = null;
let port = 0;
const token = randomBytes(24).toString('hex');
const sockets = new Map<WebSocket, string>();

type Handler = {
  onPresence?: (instanceId: string, server: string | null) => void;
  onScreenshot?: (instanceId: string, file: string) => void;
  configFor?: () => Promise<Record<string, unknown>>;
};
let handler: Handler = {};

export function setBridgeHandler(h: Handler): void {
  handler = h;
}

export function bridgeInfo(): { port: number; token: string } | null {
  return server && port ? { port, token } : null;
}

export async function startBridge(): Promise<void> {
  if (server) return;
  await new Promise<void>((resolve, reject) => {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 64 * 1024 });
    wss.once('listening', () => {
      server = wss;
      const addr = wss.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
    wss.once('error', reject);
    wss.on('connection', (ws) => {
      const timer = setTimeout(() => ws.close(4001, 'auth timeout'), 5000);
      ws.on('message', (raw) => {
        let msg: { type?: string; [k: string]: unknown };
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (msg.type === 'hello') {
          if (msg.token !== token || typeof msg.instanceId !== 'string') return ws.close(4003, 'bad token');
          clearTimeout(timer);
          sockets.set(ws, msg.instanceId);
          void (handler.configFor?.() ?? Promise.resolve({})).then((cfg) => ws.send(JSON.stringify({ type: 'config', ...cfg })));
          return;
        }
        const instanceId = sockets.get(ws);
        if (!instanceId) return;
        if (msg.type === 'fps' && typeof msg.avg === 'number' && typeof msg.low1 === 'number') {
          void recordFps(instanceId, { avg: msg.avg, low1: msg.low1, samples: Number(msg.samples) || 0, at: Date.now() });
        } else if (msg.type === 'presence') {
          handler.onPresence?.(instanceId, typeof msg.server === 'string' ? msg.server : null);
        } else if (msg.type === 'screenshot' && typeof msg.file === 'string') {
          handler.onScreenshot?.(instanceId, msg.file);
        }
      });
      ws.on('close', () => {
        clearTimeout(timer);
        sockets.delete(ws);
      });
    });
  }).catch((e) => log.warn('bridge failed to start', e));
}

export function stopBridge(): void {
  server?.close();
  server = null;
}

/* ---- FPS history used by Boost ---- */
interface FpsFile {
  first?: FpsStats;
  latest?: FpsStats;
}
const fpsFile = (id: string) => join(instanceDir(id), 'lifea', 'fps.json');

async function recordFps(id: string, s: FpsStats): Promise<void> {
  const cur = (await readJson<FpsFile>(fpsFile(id))) ?? {};
  await writeJsonAtomic(fpsFile(id), { first: cur.first ?? s, latest: s });
}

export async function fpsHistory(id: string): Promise<FpsFile> {
  return (await readJson<FpsFile>(fpsFile(id))) ?? {};
}
