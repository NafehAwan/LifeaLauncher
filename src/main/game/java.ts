/**
 * Managed Java runtimes (fixes P0-7). Picks the major version a Minecraft version needs and downloads it from
 * Mojang's runtime manifest, falling back to Adoptium Temurin. User overrides are probed and validated.
 */
import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ADOPTIUM_API, MOJANG } from '@shared/constants';
import type { JavaRuntime } from '@shared/types';
import { getJson } from '../core/http';
import { readJson, writeJsonAtomic } from '../core/fsx';
import { runtimesDir } from '../core/paths';
import { extractZip } from '../core/zip';
import { log } from '../core/log';
import { downloadAll, downloadFile, type DownloadTask, type Progress } from './download';
import { detectArch, detectOs } from './rules';

const execFileP = promisify(execFile);
const isWin = process.platform === 'win32';

export function parseJavaVersion(output: string): { version: string; major: number } | null {
  const m = output.match(/version "([^"]+)"/) ?? output.match(/java\.version = (\S+)/);
  if (!m) return null;
  const version = m[1];
  const parts = version.split(/[._-]/).map((p) => parseInt(p, 10));
  const major = parts[0] === 1 ? parts[1] : parts[0];
  return Number.isFinite(major) ? { version, major } : null;
}

export async function probeJava(path: string): Promise<JavaRuntime | null> {
  try {
    const javaCli = isWin ? path.replace(/javaw\.exe$/i, 'java.exe') : path;
    const { stdout, stderr } = await execFileP(javaCli, ['-version'], { timeout: 15000, windowsHide: true });
    const parsed = parseJavaVersion(`${stdout}\n${stderr}`);
    return parsed ? { path, major: parsed.major, version: parsed.version, managed: path.startsWith(runtimesDir()) } : null;
  } catch (e) {
    const out = `${(e as { stdout?: string }).stdout ?? ''}\n${(e as { stderr?: string }).stderr ?? ''}`;
    const parsed = parseJavaVersion(out);
    return parsed ? { path, major: parsed.major, version: parsed.version, managed: false } : null;
  }
}

/** Mojang platform key for the runtime manifest, or null when Mojang ships none (e.g. linux-arm64). */
export function mojangPlatform(): string | null {
  const os = detectOs();
  const arch = detectArch();
  if (os === 'windows') return arch === 'arm64' ? 'windows-arm64' : arch === 'x86' ? 'windows-x86' : 'windows-x64';
  if (os === 'osx') return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  if (arch === 'x86_64') return 'linux';
  if (arch === 'x86') return 'linux-i386';
  return null;
}

const DEFAULT_COMPONENT: Record<number, string> = { 8: 'jre-legacy', 16: 'java-runtime-alpha', 17: 'java-runtime-gamma', 21: 'java-runtime-delta' };

async function findJavaBinary(root: string): Promise<string | null> {
  const want = isWin ? 'javaw.exe' : 'java';
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift()!;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile() && e.name === want && dir.endsWith(`${isWin ? '\\' : '/'}bin`)) return full;
      if (e.isDirectory() && !e.name.startsWith('legal') && !e.name.startsWith('man')) queue.push(full);
    }
  }
  return null;
}

interface RuntimeMarker {
  major: number;
  version: string;
  binary: string;
  source: 'mojang' | 'adoptium';
}

export async function listRuntimes(): Promise<JavaRuntime[]> {
  const entries = await fs.readdir(runtimesDir(), { withFileTypes: true }).catch(() => []);
  const out: JavaRuntime[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const marker = await readJson<RuntimeMarker>(join(runtimesDir(), e.name, '.lifea-runtime.json'));
    if (marker) out.push({ major: marker.major, path: marker.binary, version: marker.version, managed: true });
  }
  return out.sort((a, b) => b.major - a.major);
}

interface MojangRuntimeIndex {
  [platform: string]: { [component: string]: { manifest: { sha1: string; size: number; url: string }; version: { name: string } }[] };
}
interface MojangRuntimeManifest {
  files: Record<string, { type: 'file' | 'directory' | 'link'; executable?: boolean; target?: string; downloads?: { raw: { sha1: string; size: number; url: string } } }>;
}

async function installFromMojang(major: number, component: string, opts: { signal?: AbortSignal; onProgress?: (p: Progress) => void }): Promise<RuntimeMarker | null> {
  const platform = mojangPlatform();
  if (!platform) return null;
  const index = await getJson<MojangRuntimeIndex>(MOJANG.javaRuntimes);
  const entry = index[platform]?.[component]?.[0] ?? index[platform]?.[DEFAULT_COMPONENT[major] ?? '']?.[0];
  if (!entry) return null;
  const manifest = await getJson<MojangRuntimeManifest>(entry.manifest.url);
  const root = join(runtimesDir(), `java-${major}`);
  const tasks: DownloadTask[] = [];
  const executables: string[] = [];
  const links: [string, string][] = [];
  for (const [rel, f] of Object.entries(manifest.files)) {
    const abs = join(root, ...rel.split('/'));
    if (f.type === 'directory') await fs.mkdir(abs, { recursive: true });
    else if (f.type === 'file' && f.downloads?.raw) {
      tasks.push({ url: f.downloads.raw.url, path: abs, sha1: f.downloads.raw.sha1, size: f.downloads.raw.size, name: `Java ${major}: ${rel}` });
      if (f.executable) executables.push(abs);
    } else if (f.type === 'link' && f.target) links.push([abs, f.target]);
  }
  await downloadAll(tasks, opts);
  if (!isWin) {
    await Promise.all(executables.map((p) => fs.chmod(p, 0o755).catch(() => undefined)));
    for (const [abs, target] of links) await fs.symlink(target, abs).catch(() => undefined);
  }
  const binary = await findJavaBinary(root);
  if (!binary) throw new Error(`Java ${major} downloaded but no java binary was found.`);
  return { major, version: entry.version.name, binary, source: 'mojang' };
}

interface AdoptiumAsset {
  binary: { package: { link: string; checksum: string; size: number; name: string } };
  version: { semver: string };
}

async function installFromAdoptium(major: number, opts: { signal?: AbortSignal; onProgress?: (p: Progress) => void }): Promise<RuntimeMarker> {
  const os = { windows: 'windows', osx: 'mac', linux: 'linux' }[detectOs()];
  const arch = { x86_64: 'x64', arm64: 'aarch64', x86: 'x32', arm32: 'arm' }[detectArch()];
  const assets = await getJson<AdoptiumAsset[]>(
    `${ADOPTIUM_API}/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jre&os=${os}&vendor=eclipse`,
  );
  const asset = assets[0];
  if (!asset) throw new Error(`No Java ${major} build is available for ${os}/${arch}.`);
  const pkg = asset.binary.package;
  const root = join(runtimesDir(), `java-${major}`);
  const archive = join(runtimesDir(), pkg.name);
  opts.onProgress?.({ filesDone: 0, filesTotal: 1, bytesDone: 0, bytesTotal: pkg.size, speedBps: 0, etaSec: 0, current: pkg.name });
  let done = 0;
  await downloadFile({ url: pkg.link, path: archive, size: pkg.size, name: pkg.name }, opts.signal, (n) => {
    done += n;
    opts.onProgress?.({ filesDone: 0, filesTotal: 1, bytesDone: done, bytesTotal: pkg.size, speedBps: 0, etaSec: 0, current: pkg.name });
  });
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  if (sha !== pkg.checksum) throw new Error(`Java ${major} download failed its checksum.`);
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  if (pkg.name.endsWith('.zip')) await extractZip(archive, root, (n) => n);
  else
    await new Promise<void>((resolve, reject) => {
      const p = spawn('tar', ['-xzf', archive, '-C', root]);
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`tar exited with ${c}`))));
      p.on('error', reject);
    });
  await fs.unlink(archive).catch(() => undefined);
  const binary = await findJavaBinary(root);
  if (!binary) throw new Error(`Java ${major} extracted but no java binary was found.`);
  if (!isWin) await fs.chmod(binary, 0o755).catch(() => undefined);
  return { major, version: asset.version.semver, binary, source: 'adoptium' };
}

const installing = new Map<number, Promise<string>>();

/** Return a java binary for `major`, downloading a managed runtime if needed. */
export async function ensureJava(
  major: number,
  component: string | undefined,
  opts: { signal?: AbortSignal; onProgress?: (p: Progress) => void } = {},
): Promise<string> {
  const existing = (await listRuntimes()).find((r) => r.major === major);
  if (existing && (await fs.stat(existing.path).catch(() => null))) return existing.path;
  const running = installing.get(major);
  if (running) return running;
  const job = (async () => {
    let marker: RuntimeMarker | null = null;
    try {
      marker = await installFromMojang(major, component ?? DEFAULT_COMPONENT[major] ?? '', opts);
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      log.warn(`Mojang Java ${major} install failed, trying Adoptium`, e);
    }
    if (!marker) marker = await installFromAdoptium(major, opts);
    await writeJsonAtomic(join(runtimesDir(), `java-${major}`, '.lifea-runtime.json'), marker);
    return marker.binary;
  })();
  installing.set(major, job);
  try {
    return await job;
  } finally {
    installing.delete(major);
  }
}
