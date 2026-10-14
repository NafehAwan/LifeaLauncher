/**
 * Modrinth client: cached GETs, rate-limit aware, version-correct installs with recursive required dependencies,
 * update checks by file hash, the "Optimize this profile" pack (fixes P1-2).
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { MODRINTH_API, PERFORMANCE_MODS } from '@shared/constants';
import type { BrowseQuery, ContentKind, InstallResult, Instance, ModrinthProject, ModrinthSearchResult, ModrinthVersion, UpdateInfo } from '@shared/types';
import { getJson, HttpError, postJson, sleep } from '../core/http';
import { safeJoin } from '../core/fsx';
import { instanceDir } from '../core/paths';
import { downloadFile } from './download';
import { listContent, mutateInstance, readInstance } from './instances';
import { acceptableLoaders, facetsFor, kindForProjectType, pickVersion, primaryFile } from './modrinth-select';

/* ---- cached, rate-limit-aware GET ---- */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60_000;
const MAX = 400;

async function mr<T>(path: string, ttl = TTL): Promise<T> {
  const url = `${MODRINTH_API}${path}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data as T;
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await getJson<T>(url);
      cache.set(url, { at: Date.now(), data });
      if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
      return data;
    } catch (e) {
      if (e instanceof HttpError && e.status === 429 && attempt < 3) {
        await sleep(e.retryAfterMs ?? 2000 * (attempt + 1));
        continue;
      }
      if (e instanceof HttpError && e.status === 404) throw new Error('Not found on Modrinth.');
      throw e;
    }
  }
}

export function search(q: BrowseQuery): Promise<ModrinthSearchResult> {
  const params = new URLSearchParams({
    query: q.query,
    limit: String(q.limit ?? 24),
    offset: String(q.offset),
    index: q.sort,
    facets: JSON.stringify(facetsFor(q)),
  });
  return mr<ModrinthSearchResult>(`/search?${params}`, 60_000);
}

export const getProject = (idOrSlug: string) => mr<ModrinthProject>(`/project/${encodeURIComponent(idOrSlug)}`);

export function getVersions(idOrSlug: string, filter: { gameVersion?: string; loaders?: string[] } = {}): Promise<ModrinthVersion[]> {
  const p = new URLSearchParams();
  if (filter.gameVersion) p.set('game_versions', JSON.stringify([filter.gameVersion]));
  if (filter.loaders?.length) p.set('loaders', JSON.stringify(filter.loaders));
  const qs = p.toString();
  return mr<ModrinthVersion[]>(`/project/${encodeURIComponent(idOrSlug)}/version${qs ? `?${qs}` : ''}`);
}

export const getVersion = (id: string) => mr<ModrinthVersion>(`/version/${encodeURIComponent(id)}`);

/* ---- install ---- */

async function installedProjectIds(inst: Instance): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const [, m] of Object.entries(inst.meta)) if (m.projectId) ids.add(m.projectId);
  return ids;
}

async function writeVersionFile(inst: Instance, kind: ContentKind, project: ModrinthProject, version: ModrinthVersion, signal?: AbortSignal): Promise<string> {
  const file = primaryFile(version);
  if (!file) throw new Error(`${project.title} ${version.version_number} has no downloadable file.`);
  const dir = join(instanceDir(inst.id), kind);
  await fs.mkdir(dir, { recursive: true });
  // Remove older files of the same project before writing the new one.
  for (const [key, m] of Object.entries(inst.meta)) {
    if (m.projectId === project.id && key.startsWith(`${kind}/`)) {
      const old = key.slice(kind.length + 1);
      if (old !== file.filename) {
        await fs.rm(safeJoin(dir, old), { force: true });
        await fs.rm(safeJoin(dir, `${old}.disabled`), { force: true });
        delete inst.meta[key];
      }
    }
  }
  await downloadFile({ url: file.url, path: safeJoin(dir, file.filename), sha1: file.hashes.sha1, size: file.size, name: file.filename }, signal);
  inst.meta[`${kind}/${file.filename}`] = {
    name: project.title,
    projectId: project.id,
    versionId: version.id,
    version: version.version_number,
    iconUrl: project.icon_url ?? undefined,
    source: 'modrinth',
  };
  return file.filename;
}

export async function installProject(instanceId: string, projectId: string, versionId?: string, signal?: AbortSignal): Promise<InstallResult> {
  const inst = await readInstance(instanceId);
  if (!inst) throw new Error('Profile not found.');
  const result: InstallResult = { installed: [], skipped: [], warnings: [] };
  const have = await installedProjectIds(inst);
  const visiting = new Set<string>();

  const installOne = async (pid: string, vid: string | undefined, isDependency: boolean): Promise<void> => {
    if (visiting.has(pid)) return;
    visiting.add(pid);
    const project = await getProject(pid);
    if (project.project_type === 'modpack') throw new Error('Modpacks are installed as their own profile — use “Install modpack”.');
    if (project.project_type === 'mod' && inst.loader === 'vanilla') {
      throw new Error(`${project.title} is a mod, and “${inst.name}” is a vanilla profile. Convert it to Fabric (profile settings) first.`);
    }
    if (isDependency && have.has(project.id)) {
      result.skipped.push(`${project.title} (already installed)`);
      return;
    }
    const loaders = acceptableLoaders(project.project_type, inst.loader);
    let version: ModrinthVersion | null;
    if (vid) {
      version = await getVersion(vid);
      if (!version.game_versions.includes(inst.version)) result.warnings.push(`${project.title} ${version.version_number} is not marked for Minecraft ${inst.version}.`);
    } else {
      version = pickVersion(await getVersions(project.id, { gameVersion: inst.version, loaders }), inst.version, loaders);
    }
    if (!version) {
      const msg = `${project.title} has no version for Minecraft ${inst.version}${project.project_type === 'mod' ? ` on ${inst.loader}` : ''}.`;
      if (isDependency) {
        result.warnings.push(msg);
        return;
      }
      throw new Error(msg);
    }
    const kind = kindForProjectType(project.project_type);
    const file = await writeVersionFile(inst, kind, project, version, signal);
    have.add(project.id);
    result.installed.push({ name: project.title, file, kind });
    for (const dep of version.dependencies) {
      if (dep.dependency_type === 'incompatible' && dep.project_id && have.has(dep.project_id)) {
        result.warnings.push(`${project.title} is incompatible with another installed mod (${dep.project_id}).`);
      }
      if (dep.dependency_type !== 'required') continue;
      let depProject = dep.project_id;
      let depVersion: string | undefined;
      if (!depProject && dep.version_id) {
        const v = await getVersion(dep.version_id);
        depProject = v.project_id;
        depVersion = v.game_versions.includes(inst.version) ? v.id : undefined;
      }
      if (depProject) await installOne(depProject, depVersion, true);
    }
  };

  await installOne(projectId, versionId, false);
  await mutateInstance(instanceId, (i) => {
    i.meta = inst.meta;
  });
  return result;
}

/* ---- updates ---- */

async function sha1(path: string): Promise<string> {
  return createHash('sha1').update(await fs.readFile(path)).digest('hex');
}

export async function checkUpdates(instanceId: string): Promise<UpdateInfo[]> {
  const inst = await readInstance(instanceId);
  if (!inst) return [];
  const out: UpdateInfo[] = [];
  for (const kind of ['mods', 'resourcepacks', 'shaderpacks'] as ContentKind[]) {
    const files = await listContent(instanceId, kind);
    if (!files.length) continue;
    const byHash = new Map<string, (typeof files)[number]>();
    for (const f of files) byHash.set(await sha1(join(instanceDir(instanceId), kind, f.enabled ? f.file : `${f.file}.disabled`)), f);
    const loaders = acceptableLoaders(kind === 'mods' ? 'mod' : kind === 'resourcepacks' ? 'resourcepack' : 'shader', inst.loader);
    let res: Record<string, ModrinthVersion>;
    try {
      res = await postJson<Record<string, ModrinthVersion>>(`${MODRINTH_API}/version_files/update`, {
        hashes: [...byHash.keys()],
        algorithm: 'sha1',
        loaders,
        game_versions: [inst.version],
      });
    } catch {
      continue;
    }
    for (const [hash, v] of Object.entries(res)) {
      const f = byHash.get(hash);
      const pf = primaryFile(v);
      if (!f || !pf || pf.hashes.sha1 === hash) continue;
      out.push({ file: f.file, kind, name: f.name, from: f.version ?? f.file, to: v.version_number, versionId: v.id });
    }
  }
  return out;
}

export async function applyUpdates(instanceId: string, updates: UpdateInfo[]): Promise<InstallResult> {
  const result: InstallResult = { installed: [], skipped: [], warnings: [] };
  const inst = await readInstance(instanceId);
  if (!inst) throw new Error('Profile not found.');
  for (const u of updates) {
    const v = await getVersion(u.versionId);
    const project = await getProject(v.project_id);
    // Remove the old file (even if it was added manually) before installing the new one.
    await fs.rm(safeJoin(join(instanceDir(instanceId), u.kind), u.file), { force: true });
    await fs.rm(safeJoin(join(instanceDir(instanceId), u.kind), `${u.file}.disabled`), { force: true });
    delete inst.meta[`${u.kind}/${u.file}`];
    const file = await writeVersionFile(inst, u.kind, project, v);
    result.installed.push({ name: project.title, file, kind: u.kind });
  }
  await mutateInstance(instanceId, (i) => {
    i.meta = inst.meta;
  });
  return result;
}

/* ---- optimize ---- */

/** Install the version-correct performance set. `dryRun` returns what would be installed without touching disk. */
export async function optimize(instanceId: string, dryRun: boolean, signal?: AbortSignal): Promise<InstallResult> {
  const inst = await readInstance(instanceId);
  if (!inst) throw new Error('Profile not found.');
  const result: InstallResult = { installed: [], skipped: [], warnings: [] };
  if (inst.loader === 'vanilla') {
    result.warnings.push('Performance mods need a mod loader. Convert this profile to Fabric to optimize it.');
    return result;
  }
  const have = await installedProjectIds(inst);
  const jars = (await listContent(instanceId, 'mods')).map((m) => m.file.toLowerCase());
  for (const mod of PERFORMANCE_MODS) {
    if (!mod.loaders.includes(inst.loader)) continue;
    try {
      const project = await getProject(mod.slug);
      if (have.has(project.id) || jars.some((j) => j.startsWith(mod.slug))) {
        result.skipped.push(`${mod.title} (already installed)`);
        continue;
      }
      const loaders = acceptableLoaders('mod', inst.loader);
      const version = pickVersion(await getVersions(project.id, { gameVersion: inst.version, loaders }), inst.version, loaders);
      if (!version) {
        result.skipped.push(`${mod.title} (no build for ${inst.version})`);
        continue;
      }
      if (dryRun) {
        result.installed.push({ name: mod.title, file: primaryFile(version)?.filename ?? '', kind: 'mods' });
        continue;
      }
      const r = await installProject(instanceId, project.id, version.id, signal);
      result.installed.push(...r.installed);
      result.warnings.push(...r.warnings);
    } catch (e) {
      result.warnings.push(`${mod.title}: ${(e as Error).message}`);
    }
  }
  return result;
}
