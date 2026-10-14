/**
 * Forge / NeoForge: run the official installer headless with the managed Java, then launch the version id it
 * produced. The installer handles processors (binpatching, mappings) exactly as the official launcher does.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { LOADER_META } from '@shared/constants';
import { request } from '../../core/http';
import { readJson, writeJsonAtomic } from '../../core/fsx';
import { cacheDir, gameDir } from '../../core/paths';
import { readZipEntry } from '../../core/zip';
import { abortError } from '../../core/http';
import type { VersionJson } from '../mojang';
import { versionJsonPath } from '../versions';
import { downloadFile } from '../download';

type Flavor = 'forge' | 'neoforge';

async function mavenVersions(url: string): Promise<string[]> {
  try {
    const xml = await (await request(url)).text();
    return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

/** NeoForge numbers versions after Minecraft: MC 1.21.1 → 21.1.x, MC 1.21 → 21.0.x. */
export function neoforgePrefix(mc: string): string | null {
  const m = mc.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  return `${m[1]}.${m[2] ?? '0'}.`;
}

export async function listForgeVersions(flavor: Flavor, mc: string): Promise<string[]> {
  if (flavor === 'forge') {
    const all = await mavenVersions(`${LOADER_META.forgeMaven}/maven-metadata.xml`);
    return all.filter((v) => v.startsWith(`${mc}-`)).map((v) => v.slice(mc.length + 1)).reverse();
  }
  const prefix = neoforgePrefix(mc);
  if (!prefix) return [];
  const all = await mavenVersions(`${LOADER_META.neoforgeMaven}/maven-metadata.xml`);
  return all.filter((v) => v.startsWith(prefix)).reverse();
}

function installerUrl(flavor: Flavor, mc: string, loader: string): { url: string; file: string } {
  if (flavor === 'forge') {
    const full = `${mc}-${loader}`;
    return { url: `${LOADER_META.forgeMaven}/${full}/forge-${full}-installer.jar`, file: `forge-${full}-installer.jar` };
  }
  return { url: `${LOADER_META.neoforgeMaven}/${loader}/neoforge-${loader}-installer.jar`, file: `neoforge-${loader}-installer.jar` };
}

export async function installForgeLike(
  flavor: Flavor,
  mc: string,
  loader: string | undefined,
  javaPath: string,
  opts: { signal?: AbortSignal; onLine?: (line: string) => void } = {},
): Promise<{ id: string; loader: string }> {
  const loaderVersion = loader ?? (await listForgeVersions(flavor, mc))[0];
  if (!loaderVersion) throw new Error(`${flavor === 'forge' ? 'Forge' : 'NeoForge'} has no build for Minecraft ${mc}.`);
  const { url, file } = installerUrl(flavor, mc, loaderVersion);
  const installer = join(cacheDir(), 'installers', file);
  await downloadFile({ url, path: installer, name: file }, opts.signal).catch(async (e) => {
    if (!(await fs.stat(installer).catch(() => null))) throw e;
  });

  const meta = await readZipEntry(installer, 'version.json');
  if (!meta) throw new Error(`${file} has no version.json — this ${flavor} build is too old for headless install.`);
  const id = (JSON.parse(meta.toString('utf8')) as VersionJson).id;
  if (await readJson<VersionJson>(versionJsonPath(id))) return { id, loader: loaderVersion };

  // The installer insists on a launcher_profiles.json in the target directory.
  const profiles = join(gameDir(), 'launcher_profiles.json');
  if (!(await fs.stat(profiles).catch(() => null))) await writeJsonAtomic(profiles, { profiles: {}, selectedProfile: '', version: 3 });

  const javaCli = process.platform === 'win32' ? javaPath.replace(/javaw\.exe$/i, 'java.exe') : javaPath;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(javaCli, ['-jar', installer, '--installClient', gameDir()], { cwd: gameDir(), windowsHide: true });
    const onAbort = () => child.kill();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    for (const s of [child.stdout, child.stderr]) createInterface({ input: s }).on('line', (l) => opts.onLine?.(l));
    child.on('error', reject);
    child.on('exit', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (opts.signal?.aborted) reject(abortError());
      else if (code === 0) resolve();
      else reject(new Error(`${flavor === 'forge' ? 'Forge' : 'NeoForge'} installer failed (exit ${code}). See the console for its output.`));
    });
  });
  if (!(await readJson<VersionJson>(versionJsonPath(id)))) throw new Error(`Installer finished but ${id}.json was not created.`);
  return { id, loader: loaderVersion };
}
