/** `.mrpack` import (streaming, hash-verified, traversal-safe) and export. */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { zip as fflateZip, type Zippable } from 'fflate';
import type { ContentKind, Instance, Loader } from '@shared/types';
import { safeJoin } from '../core/fsx';
import { cacheDir, instanceDir } from '../core/paths';
import { extractZip, readZipEntry } from '../core/zip';
import { log } from '../core/log';
import { downloadAll, downloadFile } from './download';
import { createInstance, listContent, mutateInstance, readInstance, removeInstance } from './instances';
import { getProject, getVersions } from './modrinth';
import { parseCdnUrl, primaryFile } from './modrinth-select';

interface MrpackIndex {
  formatVersion: number;
  game: string;
  versionId?: string;
  name: string;
  summary?: string;
  files: { path: string; hashes: { sha1?: string; sha512?: string }; downloads: string[]; fileSize?: number; env?: { client?: string; server?: string } }[];
  dependencies: Record<string, string>;
}

const ALLOWED_HOSTS = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com'];

export function loaderFromDeps(deps: Record<string, string>): { loader: Loader; loaderVersion?: string } {
  if (deps['fabric-loader']) return { loader: 'fabric', loaderVersion: deps['fabric-loader'] };
  if (deps['quilt-loader']) return { loader: 'quilt', loaderVersion: deps['quilt-loader'] };
  if (deps.neoforge) return { loader: 'neoforge', loaderVersion: deps.neoforge };
  if (deps.forge) return { loader: 'forge', loaderVersion: deps.forge };
  return { loader: 'vanilla' };
}

function kindOf(path: string): ContentKind | null {
  const top = path.split('/')[0];
  return top === 'mods' || top === 'resourcepacks' || top === 'shaderpacks' ? top : null;
}

export async function importMrpack(file: string, extra: { projectId?: string; versionId?: string; iconUrl?: string } = {}): Promise<Instance> {
  const raw = await readZipEntry(file, 'modrinth.index.json');
  if (!raw) throw new Error('This file is not a Modrinth modpack (modrinth.index.json is missing).');
  let index: MrpackIndex;
  try {
    index = JSON.parse(raw.toString('utf8')) as MrpackIndex;
  } catch {
    throw new Error('The modpack manifest is not valid JSON.');
  }
  if (index.formatVersion !== 1 || index.game !== 'minecraft') throw new Error('This modpack format is not supported.');
  const mc = index.dependencies?.minecraft;
  if (!mc) throw new Error('The modpack does not say which Minecraft version it needs.');
  const { loader, loaderVersion } = loaderFromDeps(index.dependencies);

  const inst = await createInstance({ name: index.name || basename(file, extname(file)), version: mc, loader, loaderVersion, icon: 'ender' });
  const root = instanceDir(inst.id);
  try {
    const clientFiles = index.files.filter((f) => f.env?.client !== 'unsupported');
    const tasks = clientFiles.map((f) => {
      const url = f.downloads.find((u) => {
        try {
          const parsed = new URL(u);
          return parsed.protocol === 'https:';
        } catch {
          return false;
        }
      });
      if (!url) throw new Error(`No HTTPS download for ${f.path}.`);
      if (!ALLOWED_HOSTS.includes(new URL(url).hostname)) log.warn(`mrpack: ${f.path} comes from ${new URL(url).hostname}`);
      if (!f.hashes.sha1) throw new Error(`${f.path} has no SHA-1 checksum.`);
      return { url, path: safeJoin(root, ...f.path.split('/')), sha1: f.hashes.sha1, size: f.fileSize, name: f.path };
    });
    await downloadAll(tasks);
    for (const prefix of ['overrides/', 'client-overrides/']) {
      await extractZip(file, root, (name) => (name.startsWith(prefix) ? name.slice(prefix.length) || null : null));
    }
    return await mutateInstance(inst.id, (i) => {
      for (const f of clientFiles) {
        const kind = kindOf(f.path);
        if (!kind) continue;
        const ids = f.downloads.map(parseCdnUrl).find(Boolean) ?? undefined;
        i.meta[`${kind}/${basename(f.path)}`] = { source: 'modpack', projectId: ids?.projectId, versionId: ids?.versionId };
      }
      i.modpack = { name: index.name, projectId: extra.projectId, versionId: extra.versionId ?? index.versionId };
    });
  } catch (e) {
    await removeInstance(inst.id);
    throw e;
  }
}

/** Browse → Modpacks → Install: fetch the .mrpack from Modrinth and import it. */
export async function installModpack(projectId: string, versionId?: string): Promise<Instance> {
  const project = await getProject(projectId);
  const versions = await getVersions(project.id);
  const version = versionId ? versions.find((v) => v.id === versionId) : (versions.find((v) => v.version_type === 'release') ?? versions[0]);
  if (!version) throw new Error(`${project.title} has no downloadable version.`);
  const pf = primaryFile(version);
  if (!pf) throw new Error(`${project.title} has no .mrpack file.`);
  const dest = join(cacheDir(), 'modpacks', pf.filename);
  await downloadFile({ url: pf.url, path: dest, sha1: pf.hashes.sha1, size: pf.size, name: pf.filename });
  try {
    const inst = await importMrpack(dest, { projectId: project.id, versionId: version.id });
    return await mutateInstance(inst.id, (i) => {
      i.name = project.title;
    });
  } finally {
    await fs.rm(dest, { force: true });
  }
}

async function hashes(path: string): Promise<{ sha1: string; sha512: string; size: number }> {
  const buf = await fs.readFile(path);
  return { sha1: createHash('sha1').update(buf).digest('hex'), sha512: createHash('sha512').update(buf).digest('hex'), size: buf.length };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Export a profile as .mrpack: Modrinth-hosted files by reference, everything else as overrides. */
export async function exportMrpack(id: string, dest: string): Promise<string> {
  const inst = await readInstance(id);
  if (!inst) throw new Error('Profile not found.');
  const root = instanceDir(id);
  const index: MrpackIndex = { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name: inst.name, files: [], dependencies: { minecraft: inst.version } };
  if (inst.loader === 'fabric' && inst.loaderVersion) index.dependencies['fabric-loader'] = inst.loaderVersion;
  if (inst.loader === 'quilt' && inst.loaderVersion) index.dependencies['quilt-loader'] = inst.loaderVersion;
  if (inst.loader === 'forge' && inst.loaderVersion) index.dependencies.forge = inst.loaderVersion;
  if (inst.loader === 'neoforge' && inst.loaderVersion) index.dependencies.neoforge = inst.loaderVersion;

  const files: Zippable = {};
  for (const kind of ['mods', 'resourcepacks', 'shaderpacks'] as ContentKind[]) {
    for (const c of await listContent(id, kind)) {
      if (!c.enabled) continue;
      const path = join(root, kind, c.file);
      if (c.projectId && c.versionId) {
        const h = await hashes(path);
        index.files.push({
          path: `${kind}/${c.file}`,
          hashes: { sha1: h.sha1, sha512: h.sha512 },
          downloads: [`https://cdn.modrinth.com/data/${c.projectId}/versions/${c.versionId}/${encodeURIComponent(c.file)}`],
          fileSize: h.size,
          env: { client: 'required', server: kind === 'mods' ? 'optional' : 'unsupported' },
        });
      } else {
        files[`overrides/${kind}/${c.file}`] = new Uint8Array(await fs.readFile(path));
      }
    }
  }
  for (const sub of ['config', 'options.txt', 'servers.dat']) {
    const p = join(root, sub);
    const st = await fs.stat(p).catch(() => null);
    if (!st) continue;
    const list = st.isDirectory() ? await walk(p) : [p];
    for (const f of list) files[`overrides/${relative(root, f).split('\\').join('/')}`] = new Uint8Array(await fs.readFile(f));
  }
  files['modrinth.index.json'] = new TextEncoder().encode(JSON.stringify(index, null, 2));
  const data = await new Promise<Uint8Array>((resolve, reject) => fflateZip(files, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))));
  await fs.writeFile(dest, data);
  return dest;
}
