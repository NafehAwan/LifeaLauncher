/** Asset index + objects (pooled), including legacy `virtual` / `map_to_resources` layouts (fixes P1-7). */
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { MOJANG } from '@shared/constants';
import { assetsDir } from '../core/paths';
import { readJson } from '../core/fsx';
import type { AssetIndex, VersionJson } from './mojang';
import { downloadFile, isUpToDate, type DownloadTask } from './download';

export async function loadAssetIndex(version: VersionJson): Promise<{ id: string; index: AssetIndex }> {
  const ref = version.assetIndex;
  if (!ref) throw new Error(`Version ${version.id} has no asset index.`);
  const task: DownloadTask = { url: ref.url, path: join(assetsDir(), 'indexes', `${ref.id}.json`), sha1: ref.sha1, size: ref.size, name: `assets/${ref.id}.json` };
  if (!(await isUpToDate(task))) await downloadFile(task);
  const index = await readJson<AssetIndex>(task.path);
  if (!index) throw new Error(`Asset index ${ref.id} is unreadable.`);
  return { id: ref.id, index };
}

export function assetTasks(index: AssetIndex): DownloadTask[] {
  return Object.entries(index.objects).map(([name, o]) => {
    const prefix = o.hash.slice(0, 2);
    return { url: `${MOJANG.resources}/${prefix}/${o.hash}`, path: join(assetsDir(), 'objects', prefix, o.hash), sha1: o.hash, size: o.size, name };
  });
}

/** Copy objects into the legacy layouts old versions expect. Hard-links when possible (no extra disk use). */
export async function materializeLegacyAssets(id: string, index: AssetIndex, instanceDir: string): Promise<string | undefined> {
  if (!index.virtual && !index.map_to_resources) return undefined;
  const target = index.map_to_resources ? join(instanceDir, 'resources') : join(assetsDir(), 'virtual', id);
  await Promise.all(
    Object.entries(index.objects).map(async ([name, o]) => {
      const src = join(assetsDir(), 'objects', o.hash.slice(0, 2), o.hash);
      const dst = join(target, ...name.split('/'));
      const st = await fs.stat(dst).catch(() => null);
      if (st && st.size === o.size) return;
      await fs.mkdir(join(dst, '..'), { recursive: true });
      await fs.link(src, dst).catch(() => fs.copyFile(src, dst));
    }),
  );
  return target;
}
