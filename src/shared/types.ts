/** Domain types shared by main, preload and renderer. Keep this file free of runtime imports. */

export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
export type ContentKind = 'mods' | 'resourcepacks' | 'shaderpacks';
export type ContentSource = 'modrinth' | 'manual' | 'modpack' | 'lifea';
export type BuiltinProfile = 'lifea-latest' | 'lifea-1.20.1' | 'lifea-pvp';

export interface ContentMeta {
  name?: string;
  projectId?: string;
  versionId?: string;
  version?: string;
  iconUrl?: string;
  source: ContentSource;
}

export interface ContentFile extends ContentMeta {
  /** File name without the `.disabled` suffix. */
  file: string;
  name: string;
  enabled: boolean;
  size: number;
  modified: number;
}

export interface World {
  folder: string;
  name: string;
  lastPlayed?: number;
  sizeBytes?: number;
}

export interface Screenshot {
  instanceId: string;
  file: string;
  url: string;
  taken: number;
  size: number;
}

export interface InstanceSettings {
  memoryMb?: number;
  javaPath?: string;
  jvmArgs?: string;
  resolution?: { width: number; height: number };
  fullscreen?: boolean;
  preLaunchCommand?: string;
}

export interface Instance {
  schemaVersion: 2;
  id: string;
  name: string;
  version: string;
  loader: Loader;
  loaderVersion?: string;
  icon: string;
  builtin?: BuiltinProfile;
  createdAt: number;
  lastPlayed?: number;
  playtimeMs: number;
  /** Metadata for content files, keyed by `<kind>/<file>`. The file list itself always comes from disk. */
  meta: Record<string, ContentMeta>;
  settings: InstanceSettings;
  /** Modrinth modpack this profile came from, if any. */
  modpack?: { projectId?: string; versionId?: string; name: string };
}

export interface InstanceCreateInput {
  name: string;
  version: string;
  loader: Loader;
  loaderVersion?: string;
  icon?: string;
}

export interface InstanceSummary extends Instance {
  modCount: number;
}

export type LaunchStatus =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'installing'
  | 'launching'
  | 'running'
  | 'exited'
  | 'crashed'
  | 'cancelled';

export interface CrashInfo {
  title: string;
  detail: string;
  fix?: { label: string; action: 'set-java' | 'install-fabric-api' | 'lower-memory' | 'raise-memory' | 'open-logs' | 'update-drivers' };
}

export interface LaunchState {
  instanceId: string;
  status: LaunchStatus;
  phase: string;
  /** 0..1 */
  progress: number;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  speedBps: number;
  etaSec: number;
  startedAt: number;
  runningSince?: number;
  exitCode?: number | null;
  error?: string;
  crash?: CrashInfo;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
export interface LogLine {
  ts: number;
  level: LogLevel;
  msg: string;
  src: 'game' | 'launcher';
  instanceId: string;
}

export type ThemeId = 'blood_dunes' | 'ember_night' | 'ash_oasis' | 'emberstorm';
export type LaunchBehavior = 'hide' | 'minimize' | 'keep';
export type GcPreset = 'g1' | 'zgc';

export interface Settings {
  schemaVersion: 2;
  theme: ThemeId;
  accent: string;
  animatedBackground: boolean;
  particles: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  zoom: number;
  launchBehavior: LaunchBehavior;
  closeToTray: boolean;
  gameDir: string;
  defaultMemoryMb: number;
  defaultJvmArgs: string;
  gcPreset: GcPreset;
  javaOverrides: Record<string, string>;
  parallelDownloads: number;
  maxLogLines: number;
  selectedInstanceId?: string;
  selectedAccountId?: string;
  backendUrl: string;
  friendsDrawerOpen: boolean;
  autoUpdate: boolean;
  onboarded: boolean;
}

export interface Server {
  id: string;
  name: string;
  address: string;
}

export interface MotdSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

export interface ServerStatus {
  online: boolean;
  pingMs?: number;
  players?: { online: number; max: number };
  version?: string;
  motd?: MotdSegment[];
  favicon?: string;
  error?: string;
  host?: string;
  port?: number;
}

export type AccountType = 'msa' | 'offline';
export interface Account {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  skinUrl?: string;
  skinVariant?: 'classic' | 'slim';
  capeUrl?: string;
  addedAt: number;
}

export interface MinecraftVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
}

export interface LoaderAvailability {
  vanilla: boolean;
  fabric: string[];
  quilt: string[];
  forge: string[];
  neoforge: string[];
}

export interface JavaRuntime {
  major: number;
  path: string;
  version: string;
  managed: boolean;
}

/* ---- Modrinth ---- */
export type ProjectType = 'mod' | 'modpack' | 'resourcepack' | 'shader';

export interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  categories: string[];
  display_categories?: string[];
  project_type: ProjectType;
  versions: string[];
  date_modified: string;
  client_side?: string;
  server_side?: string;
}

export interface ModrinthSearchResult {
  hits: ModrinthHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  icon_url: string | null;
  project_type: ProjectType;
  downloads: number;
  followers: number;
  categories: string[];
  game_versions: string[];
  loaders: string[];
  gallery: { url: string; title?: string | null; featured: boolean }[];
  source_url?: string | null;
  issues_url?: string | null;
}

export interface ModrinthFile {
  hashes: { sha1: string; sha512: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthDependency {
  version_id: string | null;
  project_id: string | null;
  file_name?: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: 'release' | 'beta' | 'alpha';
  game_versions: string[];
  loaders: string[];
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
  date_published: string;
  downloads: number;
}

export interface BrowseQuery {
  query: string;
  type: ProjectType;
  loader?: string;
  gameVersion?: string;
  categories?: string[];
  sort: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  offset: number;
  limit?: number;
}

export interface InstallResult {
  installed: { name: string; file: string; kind: ContentKind }[];
  skipped: string[];
  warnings: string[];
}

export interface UpdateInfo {
  file: string;
  kind: ContentKind;
  name: string;
  from: string;
  to: string;
  versionId: string;
}

/* ---- Boost ---- */
export interface BoostSuggestion {
  slug: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface FpsStats {
  avg: number;
  low1: number;
  samples: number;
  at: number;
}

export interface BoostAnalysis {
  score: number;
  system: { totalMemMb: number; freeMemMb: number; cpuModel: string; cpuThreads: number; gpu?: string };
  recommendedMemoryMb: number;
  instance: { memoryMb: number; gc: GcPreset; javaMajor?: number; loader: Loader };
  installed: string[];
  suggestions: BoostSuggestion[];
  fps?: { before?: FpsStats; latest?: FpsStats };
}

/* ---- Social / cosmetics (backend) ---- */
export type PresenceState = 'offline' | 'launcher' | 'playing';
export interface Presence {
  state: PresenceState;
  server?: string;
  version?: string;
  since?: number;
}

export interface Friend {
  uuid: string;
  username: string;
  presence: Presence;
}

export interface FriendRequest {
  id: string;
  from: { uuid: string; username: string };
  to: { uuid: string; username: string };
  createdAt: number;
  incoming: boolean;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  sentAt: number;
}

export type CosmeticType = 'cape' | 'wings' | 'hat' | 'bandana' | 'pet' | 'emote';
export interface CosmeticItem {
  id: string;
  name: string;
  type: CosmeticType;
  texture: string;
  preview?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  image?: string;
  url?: string;
  date: string;
}

export interface FeaturedServer {
  id: string;
  name: string;
  address: string;
  description: string;
}

export interface SocialStatus {
  connected: boolean;
  signedIn: boolean;
  error?: string;
  self?: { uuid: string; username: string };
}

export type SocialEvent =
  | { type: 'status'; status: SocialStatus }
  | { type: 'presence'; uuid: string; presence: Presence }
  | { type: 'message'; message: DirectMessage }
  | { type: 'friends-changed' }
  | { type: 'party-invite'; from: { uuid: string; username: string }; partyId: string };

/* ---- App ---- */
export interface AppInfo {
  version: string;
  platform: string;
  arch: string;
  electron: string;
  gpuCompositing: boolean;
  userData: string;
  msaConfigured: boolean;
}

export type UpdaterStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error' | 'disabled';
export interface UpdaterState {
  status: UpdaterStatus;
  version?: string;
  progress?: number;
  error?: string;
}

export interface AppNotice {
  level: 'info' | 'warn' | 'error';
  message: string;
  detail?: string;
}
