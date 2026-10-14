/**
 * Client for the Lifea backend (/server): auth with the Minecraft token, friends, DMs, cosmetics, news, and a
 * realtime WebSocket for presence. Everything degrades gracefully when no backend is configured.
 */
import WebSocket from 'ws';
import type { CosmeticItem, CosmeticType, DirectMessage, FeaturedServer, Friend, FriendRequest, NewsItem, Presence, SocialStatus } from '@shared/types';
import { emit } from '../core/events';
import { getJson, postJson, request } from '../core/http';
import { getSettings } from '../core/settings';
import { log } from '../core/log';
import { msaAccessToken, selectedAccount } from '../accounts/store';

let jwt: string | null = null;
let self: { uuid: string; username: string } | undefined;
let ws: WebSocket | null = null;
let status: SocialStatus = { connected: false, signedIn: false };
let reconnectTimer: NodeJS.Timeout | null = null;
let backoff = 1000;
let presence: Presence = { state: 'launcher' };

export function backendUrl(): string {
  return (getSettings().backendUrl || process.env.LIFEA_BACKEND_URL || '').replace(/\/+$/, '');
}

function setStatus(s: Partial<SocialStatus>): void {
  status = { ...status, ...s };
  emit('social:event', { type: 'status', status });
}

export function socialStatus(): SocialStatus {
  return status;
}

export function socialToken(): { url: string; token: string | null; self?: { uuid: string; username: string } } {
  return { url: backendUrl(), token: jwt, self };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = backendUrl();
  if (!base) throw new Error('No Lifea backend is configured (Settings → Advanced).');
  if (!jwt) await signIn();
  const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  const res = await request(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function signIn(): Promise<SocialStatus> {
  const base = backendUrl();
  if (!base) {
    setStatus({ connected: false, signedIn: false, error: 'No backend configured' });
    return status;
  }
  const acc = await selectedAccount();
  if (!acc) {
    setStatus({ signedIn: false, error: 'Add an account to use friends and cosmetics.' });
    return status;
  }
  try {
    const res =
      acc.type === 'msa'
        ? await postJson<{ token: string; uuid: string; username: string }>(`${base}/auth/minecraft`, { accessToken: await msaAccessToken(acc.id) })
        : await postJson<{ token: string; uuid: string; username: string }>(`${base}/auth/offline`, { uuid: acc.uuid, username: acc.username });
    jwt = res.token;
    self = { uuid: res.uuid, username: res.username };
    setStatus({ signedIn: true, self, error: undefined });
    connectRealtime();
  } catch (e) {
    jwt = null;
    const msg = acc.type === 'offline' ? 'Friends and cosmetics need a Microsoft account (this backend does not accept offline accounts).' : (e as Error).message;
    setStatus({ signedIn: false, error: msg });
  }
  return status;
}

export function signOut(): void {
  jwt = null;
  self = undefined;
  ws?.close();
  ws = null;
  setStatus({ signedIn: false, connected: false });
}

function connectRealtime(): void {
  if (!jwt) return;
  ws?.removeAllListeners();
  ws?.close();
  const url = `${backendUrl().replace(/^http/, 'ws')}/realtime?token=${encodeURIComponent(jwt)}`;
  const sock = new WebSocket(url);
  ws = sock;
  sock.on('open', () => {
    backoff = 1000;
    setStatus({ connected: true });
    sock.send(JSON.stringify({ type: 'presence', presence }));
  });
  sock.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'presence') emit('social:event', { type: 'presence', uuid: msg.uuid, presence: msg.presence });
      else if (msg.type === 'message') emit('social:event', { type: 'message', message: msg.message });
      else if (msg.type === 'friends-changed') emit('social:event', { type: 'friends-changed' });
      else if (msg.type === 'party-invite') emit('social:event', { type: 'party-invite', from: msg.from, partyId: msg.partyId });
    } catch {
      /* ignore */
    }
  });
  sock.on('close', () => {
    if (ws !== sock) return;
    setStatus({ connected: false });
    if (!jwt) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectRealtime, backoff);
    backoff = Math.min(backoff * 2, 60_000);
  });
  sock.on('error', (e) => log.debug('realtime socket error', e.message));
}

export function setPresence(p: Presence): void {
  presence = p;
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'presence', presence }));
}

export const friends = () => api<Friend[]>('/friends');
export const requests = () => api<FriendRequest[]>('/friends/requests');
export const sendRequest = (username: string) => api<void>('/friends/requests', { method: 'POST', body: JSON.stringify({ username }) });
export const respond = (id: string, accept: boolean) => api<void>(`/friends/requests/${encodeURIComponent(id)}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
export const removeFriend = (uuid: string) => api<void>(`/friends/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
export const messages = (uuid: string) => api<DirectMessage[]>(`/messages/${encodeURIComponent(uuid)}`);
export const sendMessage = (uuid: string, body: string) => api<DirectMessage>(`/messages/${encodeURIComponent(uuid)}`, { method: 'POST', body: JSON.stringify({ body }) });
export const equipped = () => api<Partial<Record<CosmeticType, string>>>('/me/cosmetics');
export const equip = (type: CosmeticType, id: string | null) => api<Partial<Record<CosmeticType, string>>>('/me/cosmetics', { method: 'PUT', body: JSON.stringify({ type, id }) });

/** Public endpoints work without signing in. */
export async function catalog(): Promise<CosmeticItem[]> {
  const base = backendUrl();
  return base ? getJson<CosmeticItem[]>(`${base}/cosmetics/catalog`) : [];
}
export async function news(): Promise<NewsItem[]> {
  const base = backendUrl();
  return base ? getJson<NewsItem[]>(`${base}/news`).catch(() => []) : [];
}
export async function featured(): Promise<FeaturedServer[]> {
  const base = backendUrl();
  return base ? getJson<FeaturedServer[]>(`${base}/featured-servers`).catch(() => []) : [];
}
