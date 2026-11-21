/** Native library extraction (fixes P0-8). Re-extracts only when the set of native jars changes. */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { extractZip } from '../core/zip';
import { readJson, writeJsonAtomic } from '../core/fsx';

const NATIVE_EXT = /\.(dll|so|dylib|jnilib)$/i;

/** Extracts into `dir` and returns the folder to use (a fresh sibling if a running game still holds the old DLLs). */
export async function extractNatives(natives: { path: string; exclude: string[] }[], dir: string): Promise<string> {
  const stamp = createHash('sha1').update(natives.map((n) => n.path).sort().join('\n')).digest('hex');
  const marker = join(dir, '.lifea-natives.json');
  const prev = await readJson<{ stamp: string }>(marker);
  if (prev?.stamp === stamp) return dir;
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Windows: EBUSY/EPERM while another instance of this version has the libraries loaded.
    dir = `${dir}-${stamp.slice(0, 8)}`;
    const reuse = await readJson<{ stamp: string }>(join(dir, '.lifea-natives.json'));
    if (reuse?.stamp === stamp) return dir;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
  await fs.mkdir(dir, { recursive: true });
  for (const n of natives) {
    const exclude = ['META-INF/', ...n.exclude];
    await extractZip(n.path, dir, (name) => {
      if (exclude.some((x) => name.startsWith(x))) return null;
      // Modern LWJGL jars nest libraries under os/arch folders; flatten them so java.library.path finds them.
      if (!NATIVE_EXT.test(name)) return null;
      return name.split('/').pop() ?? null;
    });
  }
  await writeJsonAtomic(join(dir, '.lifea-natives.json'), { stamp });
  return dir;
}
