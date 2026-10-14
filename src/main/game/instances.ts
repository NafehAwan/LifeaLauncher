/** Instance storage: instance.json metadata + content listing straight from disk (fixes P1-3, P1-4). */
import { promises as fs } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BUILTIN_PROFILES } from '@shared/constants';
import type { ContentFile, ContentKind, Instance, InstanceCreateInput, InstanceSummary, Screenshot, World } from '@shared/types';
import { readJson, safeJoin, statOrNull, writeJsonAtomic } from '../core/fsx';
import { instanceDir, instancesDir } from '../core/paths';
import { getSettings, updateSettings } from '../core/settings';

const SUBDIRS = ['mods', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs', 'config'];
const CONTENT_EXT: Record<ContentKind, RegExp> = { mods: /\.jar$/i, resourcepacks: /\.zip$/i, shaderpacks: /\.zip$/i };

const instanceFile = (id: string) => join(instanceDir(id), 'instance.json');

/** Accept agent-5 (schema 1) instance files and upgrade them in place. */
function upgrade(raw: Record<string, unknown>): Instance {
  if (raw.schemaVersion === 2) return raw as unknown as Instance;
  const old = raw as { id: string; name: string; version: string; loader: Instance['loader']; loaderVersion?: string; icon?: string; createdAt?: number; lastPlayed?: number; mods?: { file: string; name: string; projectId?: string; versionId?: string; version?: string; source?: string }[]; settings?: { maxHeap?: number; javaArgs?: string; resolution?: { width: number; height: number } } };
  const meta: Instance['meta'] = {};
  for (const m of old.mods ?? []) meta[`mods/${m.file}`] = { name: m.name, projectId: m.projectId, versionId: m.versionId, version: m.version, source: m.source === 'modrinth' ? 'modrinth' : 'manual' };
  return {
    schemaVersion: 2,
    id: old.id,
    name: old.name,
    version: old.version,
    loader: old.loader,
    loaderVersion: old.loaderVersion,
    icon: old.icon && old.icon !== 'default' ? old.icon : 'grass',
    createdAt: old.createdAt ?? Date.now(),
    lastPlayed: old.lastPlayed,
    playtimeMs: 0,
    meta,
    settings: { memoryMb: old.settings?.maxHeap ? old.settings.maxHeap * 1024 : undefined, resolution: old.settings?.resolution },
  };
}

export async function readInstance(id: string): Promise<Instance | null> {
  if (!/^[\w.-]+$/.test(id)) return null;
  const raw = await readJson<Record<string, unknown>>(instanceFile(id));
  if (!raw) return null;
  const inst = upgrade(raw);
  if (raw.schemaVersion !== 2) await writeInstance(inst);
  return inst;
}

export async function writeInstance(inst: Instance): Promise<void> {
  await writeJsonAtomic(instanceFile(inst.id), inst);
}

export async function mutateInstance(id: string, fn: (i: Instance) => void | Promise<void>): Promise<Instance> {
  const inst = await readInstance(id);
  if (!inst) throw new Error('Profile not found.');
  await fn(inst);
  await writeInstance(inst);
  return inst;
}

async function ensureSubdirs(id: string): Promise<void> {
  await Promise.all(SUBDIRS.map((d) => fs.mkdir(join(instanceDir(id), d), { recursive: true })));
}

export async function createInstance(input: InstanceCreateInput & { builtin?: Instance['builtin']; id?: string }): Promise<Instance> {
  const id = input.id ?? `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'profile'}-${randomUUID().slice(0, 6)}`;
  const inst: Instance = {
    schemaVersion: 2,
    id,
    name: input.name.trim() || `${input.loader} ${input.version}`,
    version: input.version,
    loader: input.loader,
    loaderVersion: input.loaderVersion,
    icon: input.icon ?? 'grass',
    builtin: input.builtin,
    createdAt: Date.now(),
    playtimeMs: 0,
    meta: {},
    settings: {},
  };
  await ensureSubdirs(id);
  await writeInstance(inst);
  return inst;
}

export async function listInstances(): Promise<InstanceSummary[]> {
  const dirs = await fs.readdir(instancesDir(), { withFileTypes: true }).catch(() => []);
  const all = await Promise.all(
    dirs.filter((d) => d.isDirectory()).map(async (d) => {
      const inst = await readInstance(d.name);
      if (!inst) return null;
      const mods = await fs.readdir(join(instanceDir(inst.id), 'mods')).catch(() => [] as string[]);
      return { ...inst, modCount: mods.filter((f) => /\.jar$/i.test(f)).length } satisfies InstanceSummary;
    }),
  );
  return all
    .filter((x): x is InstanceSummary => !!x)
    .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0) || (a.builtin ? -1 : 0) - (b.builtin ? -1 : 0) || b.createdAt - a.createdAt);
}

export async function duplicateInstance(id: string): Promise<Instance> {
  const src = await readInstance(id);
  if (!src) throw new Error('Profile not found.');
  const copy = await createInstance({ name: `${src.name} (copy)`, version: src.version, loader: src.loader, loaderVersion: src.loaderVersion, icon: src.icon });
  await fs.cp(instanceDir(id), instanceDir(copy.id), { recursive: true, filter: (p) => basename(p) !== 'instance.json' && !p.startsWith(join(instanceDir(id), 'logs')) });
  return mutateInstance(copy.id, (i) => {
    i.meta = { ...src.meta };
    i.settings = { ...src.settings };
  });
}

export async function removeInstance(id: string): Promise<void> {
  if (!(await readInstance(id))) return;
  await fs.rm(instanceDir(id), { recursive: true, force: true });
}

export function contentDir(id: string, kind: ContentKind): string {
  return join(instanceDir(id), kind);
}

export async function listContent(id: string, kind: ContentKind): Promise<ContentFile[]> {
  const inst = await readInstance(id);
  if (!inst) return [];
  const dir = contentDir(id, kind);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out: ContentFile[] = [];
  for (const raw of names) {
    const enabled = !raw.endsWith('.disabled');
    const file = enabled ? raw : raw.slice(0, -'.disabled'.length);
    if (!CONTENT_EXT[kind].test(file)) continue;
    const st = await statOrNull(join(dir, raw));
    if (!st?.isFile()) continue;
    const meta = inst.meta[`${kind}/${file}`];
    out.push({
      file,
      enabled,
      size: st.size,
      modified: st.mtimeMs,
      name: meta?.name ?? prettyName(file),
      source: meta?.source ?? 'manual',
      projectId: meta?.projectId,
      versionId: meta?.versionId,
      version: meta?.version,
      iconUrl: meta?.iconUrl,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function prettyName(file: string): string {
  return basename(file, extname(file)).replace(/[-_+]+/g, ' ').replace(/\s+\d[\w.]*$/, '').trim() || file;
}

/** Enable/disable by renaming `x.jar` ↔ `x.jar.disabled` (P1-4). */
export async function toggleContent(id: string, kind: ContentKind, file: string, enabled: boolean): Promise<void> {
  const dir = contentDir(id, kind);
  const on = safeJoin(dir, file);
  const off = `${on}.disabled`;
  if (enabled) await fs.rename(off, on).catch((e) => { if (e.code !== 'ENOENT') throw e; });
  else await fs.rename(on, off).catch((e) => { if (e.code !== 'ENOENT') throw e; });
}

export async function deleteContent(id: string, kind: ContentKind, files: string[]): Promise<void> {
  const dir = contentDir(id, kind);
  for (const f of files) {
    await fs.rm(safeJoin(dir, f), { force: true });
    await fs.rm(safeJoin(dir, `${f}.disabled`), { force: true });
  }
  await mutateInstance(id, (i) => {
    for (const f of files) delete i.meta[`${kind}/${f}`];
  });
}

export async function addFiles(id: string, kind: ContentKind, paths: string[]): Promise<string[]> {
  const dir = contentDir(id, kind);
  await fs.mkdir(dir, { recursive: true });
  const added: string[] = [];
  for (const p of paths) {
    const name = basename(p);
    if (!CONTENT_EXT[kind].test(name)) continue;
    await fs.copyFile(p, safeJoin(dir, name));
    added.push(name);
  }
  return added;
}

/** Read world folders. level.dat is gzipped NBT; the folder name + mtime is what players recognise anyway. */
export async function listWorlds(id: string): Promise<World[]> {
  const dir = join(instanceDir(id), 'saves');
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const worlds: World[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const level = await statOrNull(join(dir, e.name, 'level.dat'));
    if (!level) continue;
    worlds.push({ folder: e.name, name: e.name, lastPlayed: level.mtimeMs });
  }
  return worlds.sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
}

export async function listScreenshots(id?: string): Promise<Screenshot[]> {
  const ids = id ? [id] : (await listInstances()).map((i) => i.id);
  const out: Screenshot[] = [];
  for (const iid of ids) {
    const dir = join(instanceDir(iid), 'screenshots');
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const f of files) {
      if (!/\.png$/i.test(f)) continue;
      const st = await statOrNull(join(dir, f));
      if (st) out.push({ instanceId: iid, file: f, url: `app://instances/${encodeURIComponent(iid)}/screenshots/${encodeURIComponent(f)}`, taken: st.mtimeMs, size: st.size });
    }
  }
  return out.sort((a, b) => b.taken - a.taken);
}

export async function deleteScreenshot(instanceId: string, file: string): Promise<void> {
  await fs.rm(safeJoin(join(instanceDir(instanceId), 'screenshots'), file), { force: true });
}

/** Create the built-in Lifea profiles. Called on first run only, so deleting one is respected. */
export async function ensureBuiltinProfiles(): Promise<void> {
  const existing = await listInstances();
  for (const b of BUILTIN_PROFILES) {
    if (existing.some((i) => i.builtin === b.id)) continue;
    await createInstance({ id: b.id, name: b.name, version: b.version, loader: b.loader, icon: b.icon, builtin: b.id });
  }
  if (!getSettings().selectedInstanceId) updateSettings({ selectedInstanceId: BUILTIN_PROFILES[0].id });
}

export async function recordPlaytime(id: string, startedAt: number): Promise<void> {
  await mutateInstance(id, (i) => {
    i.lastPlayed = Date.now();
    i.playtimeMs = (i.playtimeMs ?? 0) + Math.max(0, Date.now() - startedAt);
  }).catch(() => undefined);
}
