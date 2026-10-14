/** Saved servers (userData/servers.json), synced into every profile's servers.dat so they show up in-game. */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from '@shared/types';
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
  for (const inst of await listInstances()) {
    const file = join(instanceDir(inst.id), 'servers.dat');
    let entries: NbtValue[] = [];
    try {
      const root = readNbt(await fs.readFile(file)).value;
      if (root.type === 'compound' && root.value.servers?.type === 'list') entries = root.value.servers.value;
    } catch {
      entries = [];
    }
    const ipOf = (e: NbtValue) => (e.type === 'compound' && e.value.ip?.type === 'string' ? e.value.ip.value : '');
    const known = new Set(entries.map(ipOf));
    for (const s of list) {
      if (known.has(s.address)) continue;
      entries.push({ type: 'compound', value: { name: { type: 'string', value: s.name }, ip: { type: 'string', value: s.address } } });
    }
    await writeFileAtomic(file, writeNbt('', { type: 'compound', value: { servers: { type: 'list', elementType: 'compound', value: entries } } }));
  }
}
