/** Local skin/cape library in <gameDir>/wardrobe, served to the renderer via app://wardrobe/… (fixes P1-5). */
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { safeJoin } from '../core/fsx';
import { wardrobeDir } from '../core/paths';

export type WardrobeKind = 'skins' | 'capes';

/** Width/height from a PNG IHDR chunk, or null if the file is not a PNG. */
export function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function validateTexture(kind: WardrobeKind, buf: Buffer): string | null {
  const size = pngSize(buf);
  if (!size) return 'Not a PNG image.';
  if (kind === 'skins') {
    const ok = (size.width === 64 && (size.height === 64 || size.height === 32)) || (size.width === 128 && size.height === 128);
    return ok ? null : `Skins must be 64×64 or 64×32 (this one is ${size.width}×${size.height}).`;
  }
  const ok = size.width === size.height * 2 || (size.width === 64 && size.height === 32) || (size.width === 22 && size.height === 17);
  return ok ? null : `Capes must be 64×32 (this one is ${size.width}×${size.height}).`;
}

export async function listWardrobe(kind: WardrobeKind): Promise<{ file: string; url: string; name: string }[]> {
  const dir = join(wardrobeDir(), kind);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  return files
    .filter((f) => /\.png$/i.test(f))
    .sort()
    .map((f) => ({ file: f, url: `app://wardrobe/${kind}/${encodeURIComponent(f)}`, name: f.replace(/\.png$/i, '').replace(/[-_]+/g, ' ') }));
}

export async function importTextures(kind: WardrobeKind, paths: string[]): Promise<string[]> {
  const dir = join(wardrobeDir(), kind);
  await fs.mkdir(dir, { recursive: true });
  const added: string[] = [];
  const errors: string[] = [];
  for (const p of paths) {
    const buf = await fs.readFile(p);
    const err = validateTexture(kind, buf);
    if (err) {
      errors.push(`${basename(p)}: ${err}`);
      continue;
    }
    const name = basename(p).replace(/[^\w.-]+/g, '_');
    await fs.writeFile(safeJoin(dir, name), buf);
    added.push(name);
  }
  if (!added.length && errors.length) throw new Error(errors.join('\n'));
  return added;
}

export async function removeTexture(kind: WardrobeKind, file: string): Promise<void> {
  await fs.rm(safeJoin(join(wardrobeDir(), kind), file), { force: true });
}
