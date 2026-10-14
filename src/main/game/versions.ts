/** Version manifest + version JSON storage and `inheritsFrom` resolution. */
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { MOJANG } from '@shared/constants';
import type { MinecraftVersion } from '@shared/types';
import { getJson } from '../core/http';
import { readJson, writeJsonAtomic } from '../core/fsx';
import { cacheDir, versionsDir } from '../core/paths';
import { log } from '../core/log';
import type { VersionJson, VersionManifest } from './mojang';
import { mergeVersions } from './resolve';
import { downloadFile, isUpToDate, type DownloadTask } from './download';

const MANIFEST_TTL = 60 * 60 * 1000;
let memManifest: { at: number; data: VersionManifest } | null = null;

export async function getManifest(force = false): Promise<VersionManifest> {
  if (!force && memManifest && Date.now() - memManifest.at < MANIFEST_TTL) return memManifest.data;
  const file = join(cacheDir(), 'version_manifest_v2.json');
  const st = await fs.stat(file).catch(() => null);
  if (!force && st && Date.now() - st.mtimeMs < MANIFEST_TTL) {
    const cached = await readJson<VersionManifest>(file);
    if (cached) return (memManifest = { at: st.mtimeMs, data: cached }).data;
  }
  try {
    const data = await getJson<VersionManifest>(MOJANG.manifest);
    await writeJsonAtomic(file, data);
    memManifest = { at: Date.now(), data };
    return data;
  } catch (e) {
    const cached = await readJson<VersionManifest>(file);
    if (cached) {
      log.warn('Using cached version manifest (offline?)', e);
      return cached;
    }
    throw new Error(`Could not load the Minecraft version list. Check your internet connection. (${(e as Error).message})`);
  }
}

export async function listVersions(includeSnapshots: boolean): Promise<MinecraftVersion[]> {
  const m = await getManifest();
  return m.versions
    .filter((v) => v.type === 'release' || (includeSnapshots && v.type === 'snapshot'))
    .map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }));
}

export const versionJsonPath = (id: string) => join(versionsDir(), id, `${id}.json`);
export const clientJarPath = (id: string) => join(versionsDir(), id, `${id}.jar`);
export const nativesDirFor = (id: string) => join(versionsDir(), id, 'natives');

/** Load a version JSON from disk, fetching vanilla ones from Mojang when missing. */
export async function loadVersionJson(id: string): Promise<VersionJson> {
  const local = await readJson<VersionJson>(versionJsonPath(id));
  if (local) return local;
  const manifest = await getManifest();
  const entry = manifest.versions.find((v) => v.id === id);
  if (!entry) throw new Error(`Minecraft version "${id}" is not installed and not in Mojang's version list.`);
  const task: DownloadTask = { url: entry.url, path: versionJsonPath(id), sha1: entry.sha1, name: `${id}.json` };
  if (!(await isUpToDate(task))) await downloadFile(task);
  const data = await readJson<VersionJson>(task.path);
  if (!data) throw new Error(`Version JSON for ${id} is unreadable.`);
  return data;
}

export async function saveVersionJson(json: VersionJson): Promise<void> {
  await writeJsonAtomic(versionJsonPath(json.id), json);
}

/** Resolve a version id, following `inheritsFrom` recursively (Fabric/Quilt/Forge → vanilla). */
export async function resolveVersion(id: string, depth = 0): Promise<VersionJson> {
  if (depth > 5) throw new Error(`inheritsFrom chain too deep at ${id}`);
  const json = await loadVersionJson(id);
  if (!json.inheritsFrom) return { ...json, jar: json.jar ?? json.id };
  const parent = await resolveVersion(json.inheritsFrom, depth + 1);
  return mergeVersions(json, parent);
}

export function clientJarTask(version: VersionJson): DownloadTask | null {
  const jarId = version.jar ?? version.id;
  const client = version.downloads?.client;
  if (!client) return null;
  return { url: client.url, path: clientJarPath(jarId), sha1: client.sha1, size: client.size, name: `${jarId}.jar` };
}
