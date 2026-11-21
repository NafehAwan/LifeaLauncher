/**
 * Fabric and Quilt via their profile/json endpoints (fixes P0-10). The returned profile is a normal version JSON
 * with `inheritsFrom: <mc>`, so `resolveVersion` merges it onto vanilla. No hand-rolled library lists.
 */
import { promises as fs } from 'node:fs';
import { LOADER_META } from '@shared/constants';
import { getJson } from '../../core/http';
import { readJson } from '../../core/fsx';
import { versionsDir } from '../../core/paths';
import type { VersionJson } from '../mojang';
import { loadVersionJson, saveVersionJson, versionJsonPath } from '../versions';

type Flavor = 'fabric' | 'quilt';

interface LoaderEntry {
  loader: { version: string; stable?: boolean };
}

const base = (f: Flavor) => (f === 'fabric' ? LOADER_META.fabric : LOADER_META.quilt);

async function fetchLoaderVersions(flavor: Flavor, mc: string): Promise<string[]> {
  const list = await getJson<LoaderEntry[]>(`${base(flavor)}/versions/loader/${encodeURIComponent(mc)}`);
  // Fabric marks stable builds; Quilt has no flag, so keep its order but push betas down.
  const sorted = [...list].sort((a, b) => {
    const sa = a.loader.stable ?? !/beta|pre|rc/i.test(a.loader.version);
    const sb = b.loader.stable ?? !/beta|pre|rc/i.test(b.loader.version);
    return Number(sb) - Number(sa);
  });
  return sorted.map((e) => e.loader.version);
}

/** For pickers: an empty list when the loader site can't be reached. */
export async function listLoaderVersions(flavor: Flavor, mc: string): Promise<string[]> {
  return fetchLoaderVersions(flavor, mc).catch(() => []);
}

/** Newest loader profile already installed for this Minecraft version (lets "latest" profiles start offline). */
async function cachedLoaderVersion(flavor: Flavor, mc: string): Promise<string | undefined> {
  const prefix = flavor === 'fabric' ? 'fabric-loader-' : 'quilt-loader-';
  const suffix = `-${mc}`;
  const ids = (await fs.readdir(versionsDir()).catch(() => [] as string[])).filter((d) => d.startsWith(prefix) && d.endsWith(suffix));
  const versions = ids.map((d) => d.slice(prefix.length, -suffix.length)).filter(Boolean);
  return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}

export const loaderVersionId = (flavor: Flavor, loader: string, mc: string) =>
  flavor === 'fabric' ? `fabric-loader-${loader}-${mc}` : `quilt-loader-${loader}-${mc}`;

/** Install the loader profile JSON (cheap: one request) and return the version id to launch. */
export async function installLoaderProfile(flavor: Flavor, mc: string, loader?: string): Promise<{ id: string; loader: string }> {
  const name = flavor === 'fabric' ? 'Fabric' : 'Quilt';
  let loaderVersion = loader;
  if (!loaderVersion) {
    try {
      loaderVersion = (await fetchLoaderVersions(flavor, mc))[0];
    } catch (e) {
      // Offline or the loader site is down: reuse an installed loader instead of claiming the version is unsupported.
      loaderVersion = await cachedLoaderVersion(flavor, mc);
      if (!loaderVersion) throw new Error(`Could not reach ${name} to install its loader for ${mc} (${(e as Error).message}). Check your connection and try again.`);
    }
  }
  if (!loaderVersion) throw new Error(`${name} does not support Minecraft ${mc} yet.`);
  const id = loaderVersionId(flavor, loaderVersion, mc);
  const existing = await readJson<VersionJson>(versionJsonPath(id));
  if (existing) return { id, loader: loaderVersion };
  const profile = await getJson<VersionJson>(
    `${base(flavor)}/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loaderVersion)}/profile/json`,
  );
  if (!profile.inheritsFrom || !Array.isArray(profile.libraries)) throw new Error(`Unexpected ${flavor} profile format for ${mc}/${loaderVersion}.`);
  await loadVersionJson(profile.inheritsFrom); // make sure the parent exists locally
  await saveVersionJson({ ...profile, id });
  return { id, loader: loaderVersion };
}
