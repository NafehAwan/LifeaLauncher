/**
 * Account storage in userData/accounts.json. Secrets (refresh/access tokens) are encrypted with the OS keychain via
 * Electron safeStorage — injected with `setSecretBox` so this module stays testable.
 */
import { randomUUID } from 'node:crypto';
import type { Account } from '@shared/types';
import { readJson, writeJsonAtomic } from '../core/fsx';
import { accountsFile } from '../core/paths';
import { getSettings, updateSettings } from '../core/settings';
import { offlineUuid, validateOfflineName } from './offline';
import { minecraftLogin, msaClientId, refreshMsa, type MinecraftSession, type MsaTokens } from './msa';

interface SecretBox {
  available(): boolean;
  encrypt(s: string): string;
  decrypt(s: string): string;
}

let box: SecretBox = { available: () => false, encrypt: (s) => s, decrypt: (s) => s };
export function setSecretBox(b: SecretBox): void {
  box = b;
}

interface Secrets {
  msa?: MsaTokens;
  mc?: { accessToken: string; expiresAt: number };
}

interface StoredAccount extends Account {
  secret?: string;
}

let cache: StoredAccount[] | null = null;

async function load(): Promise<StoredAccount[]> {
  if (cache) return cache;
  cache = (await readJson<StoredAccount[]>(accountsFile())) ?? [];
  return cache;
}

async function save(): Promise<void> {
  await writeJsonAtomic(accountsFile(), cache ?? []);
}

const publicView = ({ secret: _secret, ...a }: StoredAccount): Account => a;

function readSecrets(a: StoredAccount): Secrets {
  if (!a.secret) return {};
  try {
    return JSON.parse(box.decrypt(a.secret)) as Secrets;
  } catch {
    return {};
  }
}

function writeSecrets(a: StoredAccount, s: Secrets): void {
  a.secret = box.encrypt(JSON.stringify(s));
}

export async function listAccounts(): Promise<Account[]> {
  return (await load()).map(publicView);
}

export async function selectedAccount(): Promise<Account | null> {
  const all = await load();
  const id = getSettings().selectedAccountId;
  const acc = all.find((a) => a.id === id) ?? all[0];
  return acc ? publicView(acc) : null;
}

export async function addOfflineAccount(name: string): Promise<Account> {
  const err = validateOfflineName(name);
  if (err) throw new Error(err);
  const all = await load();
  const existing = all.find((a) => a.type === 'offline' && a.username.toLowerCase() === name.toLowerCase());
  if (existing) {
    updateSettings({ selectedAccountId: existing.id });
    return publicView(existing);
  }
  const acc: StoredAccount = { id: randomUUID(), type: 'offline', username: name, uuid: offlineUuid(name), addedAt: Date.now() };
  all.push(acc);
  await save();
  updateSettings({ selectedAccountId: acc.id });
  return publicView(acc);
}

export async function addMicrosoftAccount(tokens: MsaTokens, session: MinecraftSession): Promise<Account> {
  if (!box.available()) throw new Error('Secure storage is unavailable on this system, so Microsoft tokens cannot be saved safely.');
  const all = await load();
  let acc = all.find((a) => a.type === 'msa' && a.uuid === session.uuid);
  if (!acc) {
    acc = { id: randomUUID(), type: 'msa', username: session.username, uuid: session.uuid, addedAt: Date.now() };
    all.push(acc);
  }
  Object.assign(acc, { username: session.username, skinUrl: session.skinUrl, skinVariant: session.skinVariant, capeUrl: session.capeUrl });
  writeSecrets(acc, { msa: tokens, mc: { accessToken: session.accessToken, expiresAt: session.expiresAt } });
  await save();
  updateSettings({ selectedAccountId: acc.id });
  return publicView(acc);
}

export async function removeAccount(id: string): Promise<void> {
  const all = await load();
  cache = all.filter((a) => a.id !== id);
  await save();
  if (getSettings().selectedAccountId === id) updateSettings({ selectedAccountId: cache[0]?.id });
}

export async function updateAccountProfile(id: string, patch: Partial<Account>): Promise<Account> {
  const acc = (await load()).find((a) => a.id === id);
  if (!acc) throw new Error('Account not found.');
  Object.assign(acc, patch);
  await save();
  return publicView(acc);
}

export interface LaunchSession {
  username: string;
  uuid: string;
  accessToken: string;
  userType: 'msa' | 'legacy';
  accountId?: string;
}

/** Token for launching; refreshes Microsoft tokens when they are about to expire. */
export async function launchSession(): Promise<LaunchSession> {
  const all = await load();
  const id = getSettings().selectedAccountId;
  const acc = all.find((a) => a.id === id) ?? all[0];
  if (!acc) throw new Error('Add an account first (Settings → Accounts, or the avatar in the sidebar).');
  if (acc.type === 'offline') return { username: acc.username, uuid: acc.uuid, accessToken: '0', userType: 'legacy', accountId: acc.id };
  return { ...(await freshMinecraftToken(acc)), accountId: acc.id };
}

export async function msaAccessToken(accountId: string): Promise<string> {
  const acc = (await load()).find((a) => a.id === accountId);
  if (!acc || acc.type !== 'msa') throw new Error('Not a Microsoft account.');
  return (await freshMinecraftToken(acc)).accessToken;
}

async function freshMinecraftToken(acc: StoredAccount): Promise<Omit<LaunchSession, 'accountId'>> {
  const secrets = readSecrets(acc);
  if (secrets.mc && secrets.mc.expiresAt - Date.now() > 5 * 60_000) {
    return { username: acc.username, uuid: acc.uuid, accessToken: secrets.mc.accessToken, userType: 'msa' };
  }
  if (!secrets.msa?.refreshToken) throw new Error(`Sign in to ${acc.username} again (session expired).`);
  const clientId = msaClientId();
  if (!clientId) throw new Error('Microsoft login is not configured in this build.');
  const msa = await refreshMsa(clientId, secrets.msa.refreshToken);
  const session = await minecraftLogin(msa.accessToken);
  Object.assign(acc, { username: session.username, skinUrl: session.skinUrl, skinVariant: session.skinVariant, capeUrl: session.capeUrl });
  writeSecrets(acc, { msa, mc: { accessToken: session.accessToken, expiresAt: session.expiresAt } });
  await save();
  return { username: session.username, uuid: session.uuid, accessToken: session.accessToken, userType: 'msa' };
}
