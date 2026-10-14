/** Mojang version-JSON shapes (piston-meta) plus the loader profile JSONs that reuse them. */

export interface Rule {
  action: 'allow' | 'disallow';
  os?: { name?: string; arch?: string; version?: string };
  features?: Record<string, boolean>;
}

export type Argument = string | { rules?: Rule[]; value: string | string[] };

export interface DownloadInfo {
  path?: string;
  sha1?: string;
  size?: number;
  url: string;
}

export interface Library {
  name: string;
  url?: string;
  downloads?: {
    artifact?: DownloadInfo;
    classifiers?: Record<string, DownloadInfo>;
  };
  natives?: Partial<Record<'windows' | 'osx' | 'linux', string>>;
  extract?: { exclude?: string[] };
  rules?: Rule[];
  sha1?: string;
  size?: number;
}

export interface AssetIndexRef {
  id: string;
  sha1: string;
  size: number;
  totalSize?: number;
  url: string;
}

export interface VersionJson {
  id: string;
  inheritsFrom?: string;
  type?: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: { game?: Argument[]; jvm?: Argument[] };
  assetIndex?: AssetIndexRef;
  assets?: string;
  downloads?: { client?: DownloadInfo; server?: DownloadInfo };
  javaVersion?: { component: string; majorVersion: number };
  libraries: Library[];
  logging?: { client?: { argument: string; file: { id: string; sha1: string; size: number; url: string }; type: string } };
  releaseTime?: string;
  time?: string;
  /** Set by the launcher after resolving `inheritsFrom`: the vanilla id whose client jar is used. */
  jar?: string;
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'; url: string; time: string; releaseTime: string; sha1?: string }[];
}

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>;
  virtual?: boolean;
  map_to_resources?: boolean;
}
