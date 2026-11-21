/** Saved servers (userData/servers.json), synced into every profile's servers.dat so they show up in-game. */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from '@shared/types';
import { PARTNERED_SERVERS } from '@shared/constants';
import { readJson, writeFileAtomic, writeJsonAtomic } from '../core/fsx';
import { instanceDir, serversFile } from '../core/paths';
import { log } from '../core/log';
import { listInstances } from '../game/instances';
import { readNbt, writeNbt, type NbtValue } from './nbt';

export async function listServers(): Promise<Server[]> {
  return (await readJson<Server[]>(serversFile())) ?? [];
}

async function saveAll(list: Server[]): Promise<void> {
  await writeJsonAtomic(serversFile(), list);
  void syncServersDat(list).catch((e) => log.warn('servers.dat sync failed', e));
}

export async function saveServer(input: Omit<Server, 'id'> & { id?: string }): Promise<Server> {
  if (input.id && PARTNERED_SERVERS.some((partner) => partner.id === input.id)) throw new Error('Partnered servers are managed by LifeaLauncher.');
  const name = input.name.trim().slice(0, 64);
  const address = input.address.trim().slice(0, 255);
  if (!address) throw new Error('Enter a server address.');
  const list = await listServers();
  const existing = input.id ? list.find((s) => s.id === input.id) : undefined;
  if (existing) Object.assign(existing, { name: name || address, address });
  const server = existing ?? { id: randomUUID(), name: name || address, address };
  if (!existing) list.push(server);
  await saveAll(list);
  return server;
}

export async function removeServer(id: string): Promise<void> {
  if (PARTNERED_SERVERS.some((partner) => partner.id === id)) throw new Error('Partnered servers cannot be removed.');
  await saveAll((await listServers()).filter((s) => s.id !== id));
}

export async function reorderServers(ids: string[]): Promise<void> {
  const list = await listServers();
  const byId = new Map(list.map((s) => [s.id, s]));
  const ordered = ids.map((id) => byId.get(id)).filter((s): s is Server => !!s);
  for (const s of list) if (!ids.includes(s.id)) ordered.push(s);
  await saveAll(ordered);
}

/** Merge Lifea servers into each profile's servers.dat without removing servers the player added in-game. */
export async function syncServersDat(list: Server[]): Promise<void> {
  const isPartnerAddress = (address: string) => {
    const host = address.trim().toLowerCase().replace(/:25565$/, '').replace(/^play\./, '');
    return host === 'lifeamc.fun';
  };
  const allServers: Server[] = [
    ...PARTNERED_SERVERS.map(({ id, name, address }) => ({ id, name, address })),
    ...list.filter((server) => !isPartnerAddress(server.address)),
  ];
  for (const inst of await listInstances()) {
    try {
      await syncOne(join(instanceDir(inst.id), 'servers.dat'), allServers, isPartnerAddress);
    } catch (e) {
      // One locked or unreadable file must not stop the others (or a launch).
      log.warn(`servers.dat sync skipped for ${inst.id}`, e);
    }
  }
}

async function syncOne(file: string, allServers: Server[], isPartnerAddress: (address: string) => boolean): Promise<void> {
  let entries: NbtValue[] = [];
  const raw = await fs.readFile(file).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (raw) {
    // Never overwrite a file we couldn't parse: it holds the player's own in-game server list.
    const root = readNbt(raw).value;
    if (root.type === 'compound' && root.value.servers?.type === 'list') entries = root.value.servers.value;
  }
  // Normalize old LifeaMC aliases and remove duplicate copies left by earlier builds.
  let hasPartner = false;
  entries = entries.filter((entry) => {
    const address = entry.type === 'compound' && entry.value.ip?.type === 'string' ? entry.value.ip.value : '';
    if (!isPartnerAddress(address)) return true;
    if (hasPartner) return false;
    hasPartner = true;
    if (entry.type === 'compound') {
      entry.value.name = { type: 'string', value: '★ LifeaMC' };
      entry.value.ip = { type: 'string', value: 'lifeamc.fun' };
    }
    return true;
  });
  const ipOf = (e: NbtValue) => (e.type === 'compound' && e.value.ip?.type === 'string' ? e.value.ip.value : '');
  for (const s of allServers) {
    const existing = entries.find((entry) => ipOf(entry).toLowerCase() === s.address.toLowerCase());
    if (existing?.type === 'compound') {
      // Keep the official partner name and star even if the player previously saved an unstarred duplicate.
      if (s.id === 'lifeamc') {
        existing.value.name = { type: 'string', value: `★ ${s.name}` };
        existing.value.ip = { type: 'string', value: s.address };
      }
      continue;
    }
    entries.push({ type: 'compound', value: { name: { type: 'string', value: s.id === 'lifeamc' ? `★ ${s.name}` : s.name }, ip: { type: 'string', value: s.address } } });
  }
  await writeFileAtomic(file, writeNbt('', { type: 'compound', value: { servers: { type: 'list', elementType: 'compound', value: entries } } }));
}
