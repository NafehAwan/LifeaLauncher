/**
 * Pure version-JSON logic: `inheritsFrom` merging, Maven paths, library/native planning.
 * No I/O here so every rule is covered by unit tests (fixes P0-6, P0-8, P0-10).
 */
import { join } from 'node:path';
import { MOJANG } from '@shared/constants';
import type { Library, VersionJson } from './mojang';
import { rulesAllow, type RuleEnv } from './rules';

export interface MavenCoord {
  group: string;
  artifact: string;
  version: string;
  classifier?: string;
  ext: string;
}

export function parseMaven(name: string): MavenCoord | null {
  const [coords, extPart] = name.split('@');
  const parts = coords.split(':');
  if (parts.length < 3) return null;
  const [group, artifact, version, classifier] = parts;
  return { group, artifact, version, classifier: classifier || undefined, ext: extPart || 'jar' };
}

export function mavenPath(name: string): string | null {
  const c = parseMaven(name);
  if (!c) return null;
  const file = `${c.artifact}-${c.version}${c.classifier ? `-${c.classifier}` : ''}.${c.ext}`;
  return `${c.group.replace(/\./g, '/')}/${c.artifact}/${c.version}/${file}`;
}

/** Identity used to de-duplicate libraries: group:artifact[:classifier] (version deliberately excluded). */
export function libraryKey(name: string): string {
  const c = parseMaven(name);
  if (!c) return name;
  return `${c.group}:${c.artifact}${c.classifier ? `:${c.classifier}` : ''}`;
}

/**
 * Merge a child version (Fabric/Quilt/Forge profile) onto its parent.
 * Child libraries win on key collisions and come first; arguments are parent + child.
 */
export function mergeVersions(child: VersionJson, parent: VersionJson): VersionJson {
  const seen = new Set<string>();
  const libraries: Library[] = [];
  for (const lib of [...child.libraries, ...parent.libraries]) {
    const key = libraryKey(lib.name);
    if (seen.has(key)) continue;
    seen.add(key);
    libraries.push(lib);
  }
  const args =
    child.arguments || parent.arguments
      ? {
          game: [...(parent.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
          jvm: [...(parent.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])],
        }
      : undefined;
  return {
    ...parent,
    ...child,
    id: child.id,
    inheritsFrom: undefined,
    mainClass: child.mainClass || parent.mainClass,
    libraries,
    arguments: args,
    minecraftArguments: child.minecraftArguments ?? parent.minecraftArguments,
    assetIndex: child.assetIndex ?? parent.assetIndex,
    assets: child.assets ?? parent.assets,
    downloads: child.downloads ?? parent.downloads,
    javaVersion: child.javaVersion ?? parent.javaVersion,
    logging: child.logging ?? parent.logging,
    jar: child.jar ?? parent.jar ?? parent.id,
  };
}

export interface FileTask {
  url: string;
  path: string;
  sha1?: string;
  size?: number;
  name: string;
}

export interface LibraryPlan {
  downloads: FileTask[];
  classpath: string[];
  natives: { path: string; exclude: string[] }[];
}

const NATIVE_SUFFIX_ARCH: Record<string, RuleEnv['arch']> = { '-arm64': 'arm64', '-aarch_64': 'arm64', '-x86': 'x86', '-arm32': 'arm32' };

/** For modern `…:natives-<os>[-arch]` classifiers, the arch this jar is built for. */
export function nativeClassifierArch(classifier: string): RuleEnv['arch'] | null {
  const m = classifier.match(/^natives-(windows|macos|osx|linux)(.*)$/);
  if (!m) return null;
  const suffix = m[2];
  if (!suffix) return 'x86_64';
  return NATIVE_SUFFIX_ARCH[suffix] ?? 'x86_64';
}

export function planLibraries(version: VersionJson, env: RuleEnv, librariesRoot: string): LibraryPlan {
  const plan: LibraryPlan = { downloads: [], classpath: [], natives: [] };
  const applicable = version.libraries.filter((lib) => rulesAllow(lib.rules, env));

  // Arch filtering for modern natives: if an exact-arch variant exists for group:artifact, drop the others.
  const nativeGroups = new Map<string, Library[]>();
  for (const lib of applicable) {
    const c = parseMaven(lib.name);
    if (c?.classifier && nativeClassifierArch(c.classifier)) {
      const key = `${c.group}:${c.artifact}:${c.version}`;
      nativeGroups.set(key, [...(nativeGroups.get(key) ?? []), lib]);
    }
  }
  const droppedNatives = new Set<Library>();
  for (const libs of nativeGroups.values()) {
    const exact = libs.filter((l) => nativeClassifierArch(parseMaven(l.name)!.classifier!) === env.arch);
    const fallback = libs.filter((l) => nativeClassifierArch(parseMaven(l.name)!.classifier!) === 'x86_64');
    const keep = new Set(exact.length ? exact : fallback.length ? fallback : libs);
    for (const l of libs) if (!keep.has(l)) droppedNatives.add(l);
  }

  const seenPaths = new Set<string>();
  const addDownload = (task: FileTask) => {
    if (!task.url || seenPaths.has(task.path)) return;
    seenPaths.add(task.path);
    plan.downloads.push(task);
  };

  for (const lib of applicable) {
    if (droppedNatives.has(lib)) continue;
    const coord = parseMaven(lib.name);

    // Legacy natives (≤1.18): a classifier jar that must be extracted, never on the classpath.
    if (lib.natives) {
      const key = lib.natives[env.os]?.replace('${arch}', env.arch === 'x86' || env.arch === 'arm32' ? '32' : '64');
      const info = key ? lib.downloads?.classifiers?.[key] : undefined;
      if (key && (info || coord)) {
        const rel = info?.path ?? (coord && !coord.classifier ? mavenPath(`${lib.name}:${key}`) : null);
        if (rel) {
          const abs = join(librariesRoot, rel);
          addDownload({ url: info?.url ?? `${lib.url ?? MOJANG.libraries}${rel}`, path: abs, sha1: info?.sha1, size: info?.size, name: lib.name });
          plan.natives.push({ path: abs, exclude: lib.extract?.exclude ?? ['META-INF/'] });
        }
      }
      if (!lib.downloads?.artifact) continue;
    }

    const artifact = lib.downloads?.artifact;
    const rel = artifact?.path ?? mavenPath(lib.name);
    if (!rel) continue;
    const abs = join(librariesRoot, rel);
    const url = artifact ? artifact.url : `${(lib.url ?? MOJANG.libraries).replace(/\/?$/, '/')}${rel}`;
    addDownload({ url, path: abs, sha1: artifact?.sha1 ?? lib.sha1, size: artifact?.size ?? lib.size, name: lib.name });
    if (!plan.classpath.includes(abs)) plan.classpath.push(abs);
    if (coord?.classifier && nativeClassifierArch(coord.classifier)) plan.natives.push({ path: abs, exclude: ['META-INF/'] });
  }
  return plan;
}

/** Final classpath: libraries in order, then the version's client jar LAST (fixes P0-6). */
export function buildClasspath(plan: LibraryPlan, clientJar: string): string[] {
  return [...plan.classpath.filter((p) => p !== clientJar), clientJar];
}
