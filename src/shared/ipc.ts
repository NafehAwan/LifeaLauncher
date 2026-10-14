/**
 * Typed IPC contract. The preload only forwards channels listed here; main validates every payload with zod.
 * Add a channel in three places: `IpcInvoke`, `INVOKE_CHANNELS`, and a handler in `src/main/ipc`.
 */
import type {
  Account,
  AppInfo,
  AppNotice,
  BoostAnalysis,
  BrowseQuery,
  ContentFile,
  ContentKind,
  CosmeticItem,
  CosmeticType,
  DirectMessage,
  FeaturedServer,
  Friend,
  FriendRequest,
  InstallResult,
  Instance,
  InstanceCreateInput,
  InstanceSummary,
  JavaRuntime,
  LaunchState,
  LoaderAvailability,
  LogLine,
  MinecraftVersion,
  ModrinthProject,
  ModrinthSearchResult,
  ModrinthVersion,
  NewsItem,
  Screenshot,
  Server,
  ServerStatus,
  Settings,
  SocialEvent,
  SocialStatus,
  UpdateInfo,
  UpdaterState,
  World,
} from './types';

export interface IpcInvoke {
  'app:info': [[], AppInfo];
  'app:open-external': [[url: string], void];
  'app:open-logs': [[], void];
  'app:upload-log': [[text: string], string];
  'app:copy': [[text: string], void];

  'window:minimize': [[], void];
  'window:toggle-maximize': [[], boolean];
  'window:close': [[], void];
  'window:is-maximized': [[], boolean];

  'settings:get': [[], Settings];
  'settings:set': [[patch: Partial<Settings>], Settings];

  'instances:list': [[], InstanceSummary[]];
  'instances:get': [[id: string], Instance | null];
  'instances:create': [[input: InstanceCreateInput], Instance];
  'instances:update': [[id: string, patch: Partial<Pick<Instance, 'name' | 'icon' | 'version' | 'loader' | 'loaderVersion' | 'settings'>>], Instance];
  'instances:duplicate': [[id: string], Instance];
  'instances:remove': [[id: string], void];
  'instances:open-folder': [[id: string, sub?: string], void];
  'instances:content': [[id: string, kind: ContentKind], ContentFile[]];
  'instances:toggle-content': [[id: string, kind: ContentKind, file: string, enabled: boolean], void];
  'instances:delete-content': [[id: string, kind: ContentKind, files: string[]], void];
  'instances:add-files': [[id: string, kind: ContentKind, paths?: string[]], string[]];
  'instances:worlds': [[id: string], World[]];
  'instances:screenshots': [[id?: string], Screenshot[]];
  'instances:delete-screenshot': [[instanceId: string, file: string], void];
  'instances:export-mrpack': [[id: string], string | null];
  'instances:import-mrpack': [[path?: string], Instance | null];

  'versions:list': [[includeSnapshots: boolean], MinecraftVersion[]];
  'versions:loaders': [[mcVersion: string], LoaderAvailability];

  'launch:start': [[id: string, opts?: { server?: string; world?: string }], void];
  'launch:cancel': [[id: string], void];
  'launch:states': [[], LaunchState[]];
  'launch:logs': [[], LogLine[]];

  'java:list': [[], JavaRuntime[]];
  'java:probe': [[path: string], JavaRuntime | null];
  'java:pick': [[], string | null];

  'modrinth:search': [[q: BrowseQuery], ModrinthSearchResult];
  'modrinth:project': [[idOrSlug: string], ModrinthProject];
  'modrinth:versions': [[idOrSlug: string, filter?: { gameVersion?: string; loader?: string }], ModrinthVersion[]];
  'modrinth:install': [[instanceId: string, projectId: string, versionId?: string], InstallResult];
  'modrinth:install-modpack': [[projectId: string, versionId?: string], Instance];
  'modrinth:check-updates': [[instanceId: string], UpdateInfo[]];
  'modrinth:apply-updates': [[instanceId: string, updates: UpdateInfo[]], InstallResult];
  'modrinth:optimize': [[instanceId: string, dryRun: boolean], InstallResult];

  'servers:list': [[], Server[]];
  'servers:save': [[server: Omit<Server, 'id'> & { id?: string }], Server];
  'servers:remove': [[id: string], void];
  'servers:reorder': [[ids: string[]], void];
  'servers:ping': [[address: string], ServerStatus];

  'accounts:list': [[], Account[]];
  'accounts:select': [[id: string], void];
  'accounts:add-offline': [[name: string], Account];
  'accounts:login-microsoft': [[], Account];
  'accounts:remove': [[id: string], void];
  'accounts:upload-skin': [[accountId: string, variant: 'classic' | 'slim', path?: string], Account];

  'wardrobe:list': [[kind: 'skins' | 'capes'], { file: string; url: string; name: string }[]];
  'wardrobe:import': [[kind: 'skins' | 'capes'], string[]];
  'wardrobe:remove': [[kind: 'skins' | 'capes', file: string], void];

  'boost:analyze': [[instanceId: string], BoostAnalysis];

  'social:status': [[], SocialStatus];
  'social:connect': [[], SocialStatus];
  'social:friends': [[], Friend[]];
  'social:requests': [[], FriendRequest[]];
  'social:send-request': [[username: string], void];
  'social:respond': [[requestId: string, accept: boolean], void];
  'social:remove-friend': [[uuid: string], void];
  'social:messages': [[uuid: string], DirectMessage[]];
  'social:send-message': [[uuid: string, body: string], DirectMessage];
  'social:catalog': [[], CosmeticItem[]];
  'social:equipped': [[], Partial<Record<CosmeticType, string>>];
  'social:equip': [[type: CosmeticType, id: string | null], Partial<Record<CosmeticType, string>>];
  'social:news': [[], NewsItem[]];
  'social:featured': [[], FeaturedServer[]];

  'updater:state': [[], UpdaterState];
  'updater:check': [[], UpdaterState];
  'updater:install': [[], void];
}

export interface IpcEvents {
  'app:notice': AppNotice;
  'window:maximized': boolean;
  'settings:changed': Settings;
  'instances:changed': { id?: string };
  'launch:state': LaunchState;
  'launch:logs': LogLine[];
  'social:event': SocialEvent;
  'updater:state': UpdaterState;
}

export type InvokeChannel = keyof IpcInvoke;
export type InvokeArgs<C extends InvokeChannel> = IpcInvoke[C][0];
export type InvokeResult<C extends InvokeChannel> = IpcInvoke[C][1];
export type EventChannel = keyof IpcEvents;

export const INVOKE_CHANNELS = [
  'app:info', 'app:open-external', 'app:open-logs', 'app:upload-log', 'app:copy',
  'window:minimize', 'window:toggle-maximize', 'window:close', 'window:is-maximized',
  'settings:get', 'settings:set',
  'instances:list', 'instances:get', 'instances:create', 'instances:update', 'instances:duplicate', 'instances:remove',
  'instances:open-folder', 'instances:content', 'instances:toggle-content', 'instances:delete-content', 'instances:add-files',
  'instances:worlds', 'instances:screenshots', 'instances:delete-screenshot', 'instances:export-mrpack', 'instances:import-mrpack',
  'versions:list', 'versions:loaders',
  'launch:start', 'launch:cancel', 'launch:states', 'launch:logs',
  'java:list', 'java:probe', 'java:pick',
  'modrinth:search', 'modrinth:project', 'modrinth:versions', 'modrinth:install', 'modrinth:install-modpack',
  'modrinth:check-updates', 'modrinth:apply-updates', 'modrinth:optimize',
  'servers:list', 'servers:save', 'servers:remove', 'servers:reorder', 'servers:ping',
  'accounts:list', 'accounts:select', 'accounts:add-offline', 'accounts:login-microsoft', 'accounts:remove', 'accounts:upload-skin',
  'wardrobe:list', 'wardrobe:import', 'wardrobe:remove',
  'boost:analyze',
  'social:status', 'social:connect', 'social:friends', 'social:requests', 'social:send-request', 'social:respond',
  'social:remove-friend', 'social:messages', 'social:send-message', 'social:catalog', 'social:equipped', 'social:equip',
  'social:news', 'social:featured',
  'updater:state', 'updater:check', 'updater:install',
] as const satisfies readonly InvokeChannel[];

export const EVENT_CHANNELS = [
  'app:notice', 'window:maximized', 'settings:changed', 'instances:changed', 'launch:state', 'launch:logs', 'social:event', 'updater:state',
] as const satisfies readonly EventChannel[];

// Compile-time guarantee that every contract key is whitelisted.
type MissingInvoke = Exclude<InvokeChannel, (typeof INVOKE_CHANNELS)[number]>;
type MissingEvent = Exclude<EventChannel, (typeof EVENT_CHANNELS)[number]>;
export const _ipcContractComplete: [MissingInvoke, MissingEvent] extends [never, never] ? true : never = true;

/** Shape exposed on `window.lifea` by the preload. */
export interface LifeaBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>;
  on<E extends EventChannel>(channel: E, cb: (payload: IpcEvents[E]) => void): () => void;
  /** Absolute path of a file dropped onto the window (Electron webUtils). */
  pathForFile(file: File): string;
}
