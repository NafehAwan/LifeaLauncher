/** Pure Modrinth version selection (fixes P1-2). Unit tested. */
import type { ContentKind, Loader, ModrinthVersion, ProjectType } from '@shared/types';

export function kindForProjectType(t: ProjectType): ContentKind {
  return t === 'resourcepack' ? 'resourcepacks' : t === 'shader' ? 'shaderpacks' : 'mods';
}

/** Which Modrinth "loaders" values are acceptable for a project type in a profile. */
export function acceptableLoaders(type: ProjectType, loader: Loader): string[] {
  if (type === 'resourcepack') return ['minecraft'];
  if (type === 'shader') return ['iris', 'optifine', 'canvas', 'vanilla'];
  if (loader === 'quilt') return ['quilt', 'fabric'];
  return [loader];
}

const RANK = { release: 0, beta: 1, alpha: 2 } as const;

/** Newest compatible version, preferring release > beta > alpha. */
export function pickVersion(versions: ModrinthVersion[], gameVersion: string, loaders: string[]): ModrinthVersion | null {
  const ok = versions.filter((v) => v.game_versions.includes(gameVersion) && (loaders.length === 0 || v.loaders.some((l) => loaders.includes(l))));
  if (!ok.length) return null;
  return [...ok].sort((a, b) => RANK[a.version_type] - RANK[b.version_type] || Date.parse(b.date_published) - Date.parse(a.date_published))[0];
}

export function primaryFile(v: ModrinthVersion) {
  return v.files.find((f) => f.primary) ?? v.files[0] ?? null;
}

/** Project and version ids are encoded in Modrinth CDN URLs: /data/<project>/versions/<version>/<file>. */
export function parseCdnUrl(url: string): { projectId: string; versionId: string } | null {
  const m = url.match(/^https:\/\/cdn\.modrinth\.com\/data\/([A-Za-z0-9]+)\/versions\/([A-Za-z0-9]+)\//);
  return m ? { projectId: m[1], versionId: m[2] } : null;
}

export function facetsFor(q: { type: ProjectType; loader?: string; gameVersion?: string; categories?: string[] }): string[][] {
  const f: string[][] = [[`project_type:${q.type}`]];
  if (q.gameVersion) f.push([`versions:${q.gameVersion}`]);
  if (q.loader && q.type !== 'resourcepack' && q.type !== 'shader') f.push(q.loader === 'quilt' ? ['categories:quilt', 'categories:fabric'] : [`categories:${q.loader}`]);
  for (const c of q.categories ?? []) f.push([`categories:${c}`]);
  return f;
}
