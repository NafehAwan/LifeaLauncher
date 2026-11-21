/**
 * Account storage in userData/accounts.json. Secrets (refresh/access tokens) are encrypted with the OS keychain via
 * Electron safeStorage — injected with `setSecretBox` so this module stays testable.
 */
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Account } from '@shared/types';
import { log } from '../core/log';
import { writeJsonAtomic } from '../core/fsx';
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
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(accountsFile(), 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return (cache = []);
    log.error('[accounts] Could not parse accounts.json', error);
    // Keep the damaged file for recovery, but do not make account creation and launch
    // permanently unavailable. The next save writes the canonical array format.
    const backup = await backupAccountsFile();
    log.warn('[accounts] Preserved unreadable accounts.json and started a clean account store.', backup);
    cache = [];
    await save();
    return cache;
  }
  const normalized = normalizeStoredAccounts(raw);
  if (!normalized) {
    const shape = raw && typeof raw === 'object' ? raw as Record<string, unknown> : undefined;
    log.error('[accounts] Invalid accounts.json shape before account selection', {
      type: typeof raw,
      isArray: Array.isArray(raw),
      isNull: raw === null,
      keys: shape ? Object.keys(shape) : undefined,
      constructor: shape?.constructor?.name,
    });
    const backup = await backupAccountsFile();
    log.warn('[accounts] Preserved unsupported accounts.json and started a clean account store.', backup);
    cache = [];
    await save();
    return cache;
  }
  if (normalized.migrated) {
    const backup = await backupAccountsFile();
    log.warn(`[accounts] Migrated legacy account store to an array (${normalized.accounts.length} accounts). Backup: ${backup}`);
    cache = normalized.accounts;
    await save();
    return cache;
  }
  cache = normalized.accounts;
  return cache;
}

async function backupAccountsFile(): Promise<string> {
  const backup = `${accountsFile()}.backup-${Date.now()}`;
  await fs.copyFile(accountsFile(), backup);
  return backup;
}

/** Migrate known launcher account shapes and reject records that do not contain a usable identity. */
function normalizeStoredAccounts(value: unknown): { accounts: StoredAccount[]; migrated: boolean } | null {
  const extracted = extractAccountEntries(value);
  if (!extracted) return null;
  const { entries } = extracted;
  let migrated = extracted.migrated;

  const accounts: StoredAccount[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      migrated = true;
      continue;
    }
    const a = entry as Record<string, unknown>;
    const profile = a.profile && typeof a.profile === 'object' && !Array.isArray(a.profile) ? a.profile as Record<string, unknown> : {};
    const identity = a.account && typeof a.account === 'object' && !Array.isArray(a.account) ? a.account as Record<string, unknown> : {};
    const rawType = String(a.type ?? a.accountType ?? a.kind ?? identity.type ?? '').toLowerCase();
    const hasMsaCredentials = Boolean(a.refreshToken || a.refresh_token || identity.refreshToken || identity.refresh_token);
    const type: Account['type'] | undefined = a.offline === true || identity.offline === true || ['offline', 'legacy'].includes(rawType)
      ? 'offline'
      : ['msa', 'microsoft', 'mojang', 'online'].includes(rawType) || (rawType === '' && hasMsaCredentials)
        ? 'msa'
        // Older Lifea versions stored offline accounts without a type discriminator.
        // Treat a record without MSA credentials as offline instead of discarding it.
        : rawType === '' ? 'offline' : undefined;
    const username = [a.username, a.name, a.playerName, a.displayName, profile.username, profile.name, profile.displayName, identity.username, identity.name].find((v): v is string => typeof v === 'string' && !!v.trim())?.trim();
    if (!type || !username || (type === 'offline' && validateOfflineName(username))) {
      migrated = true;
      continue;
    }
    const uuidValue = [a.uuid, a.playerId, profile.uuid, profile.id, identity.uuid, a.id].find((v): v is string => typeof v === 'string' && /^[\da-f-]{32,36}$/i.test(v));
    const uuid = uuidValue ?? (type === 'offline' ? offlineUuid(username) : undefined);
    if (!uuid) {
      migrated = true;
      continue;
    }
    const secret = typeof a.secret === 'string' ? a.secret : typeof a.encryptedSecret === 'string' ? a.encryptedSecret : undefined;
    const account: StoredAccount = {
      // Keep the id we already gave this account: settings.selectedAccountId points at it.
      id: typeof a.id === 'string' && a.id.trim() ? a.id : typeof a.accountId === 'string' && a.accountId.trim() ? a.accountId : randomUUID(),
      type,
      username,
      uuid,
      addedAt: typeof a.addedAt === 'number' && Number.isFinite(a.addedAt) ? a.addedAt : typeof a.createdAt === 'number' && Number.isFinite(a.createdAt) ? a.createdAt : Date.now() + index,
      ...(typeof a.skinUrl === 'string' ? { skinUrl: a.skinUrl } : {}),
      ...(a.skinVariant === 'classic' || a.skinVariant === 'slim' ? { skinVariant: a.skinVariant } : {}),
      ...(typeof a.capeUrl === 'string' ? { capeUrl: a.capeUrl } : {}),
      ...(typeof a.localCapeFile === 'string' && /^[\w.-]+\.png$/i.test(a.localCapeFile) ? { localCapeFile: a.localCapeFile } : {}),
      ...(typeof a.localSkinFile === 'string' && /^[\w.-]+\.png$/i.test(a.localSkinFile) ? { localSkinFile: a.localSkinFile } : {}),
      ...(a.localCosmetics && typeof a.localCosmetics === 'object' ? { localCosmetics: Object.fromEntries(Object.entries(a.localCosmetics as Record<string, unknown>).filter(([key, value]) => ['wings', 'hat', 'bandana'].includes(key) && typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value))) } : {}),
      ...(secret ? { secret } : {}),
    };
    if (account.id !== a.id || account.type !== a.type || account.username !== a.username || account.uuid !== a.uuid || account.addedAt !== a.addedAt) migrated = true;
    accounts.push(account);
  }
  if (entries.length > 0 && accounts.length === 0) return null;
  return { accounts, migrated };
}

/** The app has shipped both a plain array and versioned `{ formatVersion, accounts }` stores. */
function extractAccountEntries(value: unknown, depth = 0): { entries: unknown[]; migrated: boolean } | null {
  if (depth > 4) return null;
  if (Array.isArray(value)) return { entries: value, migrated: depth > 0 };
  if (!value || typeof value !== 'object') return null;
  const root = value as Record<string, unknown>;
  for (const key of ['accounts', 'profiles', 'entries', 'items', 'data']) {
    if (key in root) {
      const nested = extractAccountEntries(root[key], depth + 1);
      if (nested) return { ...nested, migrated: true };
    }
  }
  const entries = Object.entries(root).filter(([key]) => !['formatVersion', 'schemaVersion', 'version', 'selectedAccountId'].includes(key));
  if (entries.length === 0) return { entries: [], migrated: depth > 0 };
  if (!entries.every(([, account]) => account && typeof account === 'object' && !Array.isArray(account))) return null;
  return { entries: entries.map(([id, account]) => ({ id, ...(account as Record<string, unknown>) })), migrated: true };
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
  log.debug('[launch] Account store shape before selection', {
    type: typeof all,
    isArray: Array.isArray(all),
    isNull: all === null,
    keys: all ? Object.keys(all).slice(0, 10) : 'null',
    constructor: all?.constructor?.name,
    count: all.length,
  });
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
