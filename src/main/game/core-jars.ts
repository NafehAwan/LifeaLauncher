/** Picks the bundled Lifea client jars that match a profile exactly. No Electron imports, so it is unit-tested. */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/** True when a Fabric API file/version string is built for exactly this Minecraft version ("…+1.21.1" ≠ "…+1.21.11"). */
export function fabricApiMatches(text: string, mc: string): boolean {
  const escaped = mc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\+${escaped}(?![\\d.])`).test(text);
}

export function atLeastVersion(actual: string | undefined, required: string): boolean {
  if (!actual) return false;
  const parse = (value: string) => value.split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10));
  const a = parse(actual);
  const b = parse(required);
  if ([...a, ...b].some((part) => !Number.isFinite(part))) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

/**
 * Jars named `<id>-<version>+mc<mc>.jar` in the given folders, for Fabric only. `loaderVersion` must be the loader that
 * is actually installed for this launch; when unknown we assume the minimum is met (every loader Lifea installs is newer).
 */
export async function findCoreJars(dirs: string[], mc: string, loader: string, loaderVersion?: string): Promise<string[]> {
  if (loader !== 'fabric') return [];
  const hits: string[] = [];
  for (const dir of dirs) {
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith(`+mc${mc}.jar`) || file.includes('sources')) continue;
      if (file.startsWith('tuff-client-') && loaderVersion && !atLeastVersion(loaderVersion, '0.19.5')) continue;
      if (file.startsWith('lifea-core-') && loaderVersion && !atLeastVersion(loaderVersion, '0.16.0')) continue;
      if (file.startsWith('lifea-core-') || file.startsWith('tuff-client-')) hits.push(join(dir, file));
    }
  }
  return hits;
}
