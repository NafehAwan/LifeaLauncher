/**
 * Fabric and Quilt via their profile/json endpoints (fixes P0-10). The returned profile is a normal version JSON
 * with `inheritsFrom: <mc>`, so `resolveVersion` merges it onto vanilla. No hand-rolled library lists.
 */
import { LOADER_META } from '@shared/constants';
import { getJson } from '../../core/http';
import type { VersionJson } from '../mojang';
import { loadVersionJson, saveVersionJson } from '../versions';
import { readJson } from '../../core/fsx';
import { versionJsonPath } from '../versions';

type Flavor = 'fabric' | 'quilt';

interface LoaderEntry {
  loader: { version: string; stable?: boolean };
}

const base = (f: Flavor) => (f === 'fabric' ? LOADER_META.fabric : LOADER_META.quilt);

export async function listLoaderVersions(flavor: Flavor, mc: string): Promise<string[]> {
  try {
    const list = await getJson<LoaderEntry[]>(`${base(flavor)}/versions/loader/${encodeURIComponent(mc)}`);
    // Fabric marks stable builds; Quilt has no flag, so keep its order but push betas down.
    const sorted = [...list].sort((a, b) => {
      const sa = a.loader.stable ?? !/beta|pre|rc/i.test(a.loader.version);
      const sb = b.loader.stable ?? !/beta|pre|rc/i.test(b.loader.version);
      return Number(sb) - Number(sa);
    });
    return sorted.map((e) => e.loader.version);
  } catch {
    return [];
  }
}

export const loaderVersionId = (flavor: Flavor, loader: string, mc: string) =>
  flavor === 'fabric' ? `fabric-loader-${loader}-${mc}` : `quilt-loader-${loader}-${mc}`;

/** Install the loader profile JSON (cheap: one request) and return the version id to launch. */
export async function installLoaderProfile(flavor: Flavor, mc: string, loader?: string): Promise<{ id: string; loader: string }> {
  const loaderVersion = loader ?? (await listLoaderVersions(flavor, mc))[0];
  if (!loaderVersion) throw new Error(`${flavor === 'fabric' ? 'Fabric' : 'Quilt'} does not support Minecraft ${mc} yet.`);
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
