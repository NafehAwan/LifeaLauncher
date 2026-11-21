/** Single source of truth for IDs and defaults used by main, preload and renderer. */
import type { BuiltinProfile, Loader, Settings, ThemeId } from './types';

export const APP_NAME = 'LifeaLauncher';
export const REPO_URL = 'https://github.com/nafehawan/lifealauncher';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  gradient: string;
  layers: string[];
}

export const THEMES: ThemeDef[] = [
  { id: 'blood_dunes', name: 'Blood Dunes', description: 'Crimson sands under a dying sun', gradient: 'linear-gradient(135deg,#1a0709,#9b0f1c)', layers: ['sky', 'clouds', 'dunes_far', 'dunes_near', 'cacti'] },
  { id: 'ember_night', name: 'Ember Night', description: 'Glowing coals in a dark sky', gradient: 'linear-gradient(135deg,#120607,#ff6a2b)', layers: ['sky', 'clouds', 'dunes_far', 'dunes_near', 'embers'] },
  { id: 'ash_oasis', name: 'Ash Oasis', description: 'Grey stillness, one red spring', gradient: 'linear-gradient(135deg,#1b1214,#6b5353)', layers: ['sky', 'clouds', 'dunes_far', 'dunes_near', 'cacti'] },
  { id: 'emberstorm', name: 'Emberstorm', description: 'Wind, sparks and red lightning', gradient: 'linear-gradient(135deg,#200b0f,#e11d2e)', layers: ['sky', 'clouds', 'dunes_far', 'dunes_near', 'cacti'] },
];
export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

/** Old hyphenated IDs from agent-2 settings files → current IDs (bug P1-1). */
export const LEGACY_THEME_IDS: Record<string, ThemeId> = {
  'blood-dunes': 'blood_dunes',
  'ember-night': 'ember_night',
  'ash-oasis': 'ash_oasis',
  emberstorm: 'emberstorm',
};

export const ACCENT_PRESETS = [
  { name: 'Crimson', color: '#e11d2e' },
  { name: 'Blood', color: '#b3121f' },
  { name: 'Ruby', color: '#d61f5a' },
  { name: 'Scarlet', color: '#ff2a1a' },
  { name: 'Ember', color: '#ff6a2b' },
] as const;

export const LOADERS: { id: Loader; name: string }[] = [
  { id: 'vanilla', name: 'Vanilla' },
  { id: 'fabric', name: 'Fabric' },
  { id: 'quilt', name: 'Quilt' },
  { id: 'forge', name: 'Forge' },
  { id: 'neoforge', name: 'NeoForge' },
];

/** Built-in Lifea partner servers are launcher-managed and always synced to instances. */
export const PARTNERED_SERVERS = [
  { id: 'lifeamc', name: 'LifeaMC', address: 'lifeamc.fun', subtitle: 'Official Lifea Minecraft network' },
] as const;

export const INSTANCE_ICONS = ['grass', 'diamond', 'sword', 'pickaxe', 'tnt', 'ender', 'redstone', 'netherite'] as const;

export const BUILTIN_PROFILES: { id: BuiltinProfile; name: string; version: string; loader: Loader; icon: string }[] = [
  { id: 'lifea-1.21.11', name: 'Lifea 1.21.11', version: '1.21.11', loader: 'fabric', icon: 'netherite' },
  { id: 'lifea-latest', name: 'Lifea 1.21.4', version: '1.21.4', loader: 'fabric', icon: 'tnt' },
  { id: 'lifea-1.20.1', name: 'Lifea 1.20.1', version: '1.20.1', loader: 'fabric', icon: 'diamond' },
  { id: 'lifea-pvp', name: 'Lifea PvP 1.8.9', version: '1.8.9', loader: 'vanilla', icon: 'sword' },
];

/** Version-correct performance set installed by "Optimize this profile" (Modrinth slugs). */
export const PERFORMANCE_MODS: { slug: string; title: string; description: string; impact: 'High' | 'Medium' | 'Low'; loaders: Loader[] }[] = [
  { slug: 'fabric-api', title: 'Fabric API', description: 'Compatibility library required by many Fabric client mods.', impact: 'Low', loaders: ['fabric'] },
  { slug: 'sodium', title: 'Sodium', description: 'Optimized Fabric-family renderer; installs only when Modrinth has an exact compatible build.', impact: 'High', loaders: ['fabric', 'quilt'] },
  { slug: 'embeddium', title: 'Embeddium', description: 'Optimized renderer for Forge and NeoForge profiles.', impact: 'High', loaders: ['forge', 'neoforge'] },
  { slug: 'lithium', title: 'Lithium', description: 'Improves game logic and server-side ticks without changing vanilla behavior.', impact: 'Medium', loaders: ['fabric', 'quilt'] },
  { slug: 'ferrite-core', title: 'FerriteCore', description: 'Reduces memory use by optimizing block-state storage.', impact: 'Medium', loaders: ['fabric', 'quilt', 'forge', 'neoforge'] },
  { slug: 'modernfix', title: 'ModernFix', description: 'Version-aware memory, load-time and bug fixes for supported profiles.', impact: 'Medium', loaders: ['fabric', 'quilt', 'forge', 'neoforge'] },
  { slug: 'entityculling', title: 'EntityCulling', description: 'Skips rendering entities and block entities hidden from view.', impact: 'Medium', loaders: ['fabric', 'quilt', 'forge', 'neoforge'] },
  { slug: 'immediatelyfast', title: 'ImmediatelyFast', description: 'Reduces immediate-mode rendering overhead where supported.', impact: 'Medium', loaders: ['fabric', 'quilt', 'forge', 'neoforge'] },
  { slug: 'moreculling', title: 'More Culling', description: 'Adds conservative block and face culling for compatible Fabric profiles.', impact: 'Low', loaders: ['fabric', 'quilt'] },
  { slug: 'dynamic-fps', title: 'Dynamic FPS', description: 'Lowers idle resource use when Minecraft is unfocused.', impact: 'Low', loaders: ['fabric', 'quilt', 'forge', 'neoforge'] },
  { slug: 'foamfix', title: 'FoamFix', description: 'Legacy memory optimization where a compatible Forge or Fabric build exists.', impact: 'Medium', loaders: ['fabric', 'forge'] },
  { slug: 'noisium', title: 'Noisium', description: 'Optimizes world-generation noise calculations where supported.', impact: 'Low', loaders: ['fabric', 'quilt'] },
  { slug: 'starlight', title: 'Starlight', description: 'Legacy lighting engine for versions that still have a compatible release.', impact: 'Medium', loaders: ['fabric', 'quilt', 'forge'] },
];

export const DEFAULT_JVM_ARGS = '';

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  theme: 'blood_dunes',
  accent: '#e11d2e',
  animatedBackground: true,
  particles: true,
  reducedMotion: 'system',
  zoom: 1,
  launchBehavior: 'hide',
  closeToTray: false,
  gameDir: '',
  defaultMemoryMb: 4096,
  defaultJvmArgs: DEFAULT_JVM_ARGS,
  gcPreset: 'g1',
  javaOverrides: {},
  parallelDownloads: 48,
  maxLogLines: 20000,
  selectedInstanceId: undefined,
  selectedAccountId: undefined,
  backendUrl: '',
  friendsDrawerOpen: false,
  autoUpdate: true,
  onboarded: false,
};

export const ROUTES = {
  home: '/',
  library: '/library',
  instance: '/instance/:id',
  browse: '/browse',
  boost: '/boost',
  wardrobe: '/wardrobe',
  friends: '/friends',
  servers: '/servers',
  screenshots: '/screenshots',
  console: '/console',
  settings: '/settings',
  showcase: '/showcase',
} as const;

export const OFFLINE_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export const MOJANG = {
  manifest: 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  javaRuntimes: 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json',
  resources: 'https://resources.download.minecraft.net',
  libraries: 'https://libraries.minecraft.net/',
} as const;

export const LOADER_META = {
  fabric: 'https://meta.fabricmc.net/v2',
  quilt: 'https://meta.quiltmc.org/v3',
  forgeMaven: 'https://maven.minecraftforge.net/net/minecraftforge/forge',
  neoforgeMaven: 'https://maven.neoforged.net/releases/net/neoforged/neoforge',
} as const;

export const MODRINTH_API = 'https://api.modrinth.com/v2';
export const ADOPTIUM_API = 'https://api.adoptium.net/v3';
