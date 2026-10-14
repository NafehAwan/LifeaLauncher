/** Small async fs helpers. Everything here is non-blocking. */
import { promises as fs } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function statOrNull(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

export async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Atomic write: write to a temp file next to the target, then rename over it. */
export async function writeFileAtomic(p: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, p);
}

export async function writeJsonAtomic(p: string, value: unknown): Promise<void> {
  await writeFileAtomic(p, JSON.stringify(value, null, 2));
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/** Resolve `child` inside `root`, throwing if it would escape (path traversal guard). */
export function safeJoin(root: string, ...parts: string[]): string {
  const base = resolve(root);
  const target = resolve(base, ...parts);
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`Path escapes ${root}: ${parts.join('/')}`);
  return target;
}

export async function dirSize(p: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries.map(async (e) => {
      const full = `${p}/${e.name}`;
      if (e.isDirectory()) total += await dirSize(full);
      else total += (await statOrNull(full))?.size ?? 0;
    }),
  );
  return total;
}
