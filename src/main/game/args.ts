/** JVM + game argument builder (fixes P0-9). Pure — unit tested. */
import type { GcPreset } from '@shared/types';
import type { Argument, VersionJson } from './mojang';
import { rulesAllow, type RuleEnv } from './rules';

/** Split a user-supplied argument string shell-style: quotes group, backslash escapes inside double quotes. */
export function splitArgs(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && (input[i + 1] === '"' || input[i + 1] === '\\')) cur += input[++i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur || has) out.push(cur);
      cur = '';
      has = false;
    } else {
      cur += ch;
      has = true;
    }
  }
  if (cur || has) out.push(cur);
  return out;
}

export function gcFlags(javaMajor: number, preset: GcPreset, totalSystemMb: number): string[] {
  if (preset === 'zgc' && javaMajor >= 21 && totalSystemMb >= 12000) return ['-XX:+UseZGC', '-XX:+ZGenerational'];
  if (javaMajor >= 17) {
    return [
      '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC', '-XX:+AlwaysPreTouch', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40',
      '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20', '-XX:InitiatingHeapOccupancyPercent=15',
    ];
  }
  return ['-XX:+UseG1GC', '-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=20', '-XX:G1ReservePercent=20', '-XX:MaxGCPauseMillis=50', '-XX:G1HeapRegionSize=32M'];
}

/** System-aware memory recommendation in MB: ~35 % of RAM, 2–8 GB (10 GB for big packs), never above half of RAM. */
export function recommendMemoryMb(totalMb: number, modCount = 0): number {
  const cap = modCount > 120 ? 10240 : 8192;
  const rec = Math.min(Math.max(2048, Math.floor((totalMb * 0.35) / 512) * 512), cap);
  return Math.max(1024, Math.min(rec, Math.floor(totalMb / 2 / 512) * 512 || 1024));
}

export interface LaunchArgsInput {
  version: VersionJson;
  env: RuleEnv;
  vars: Record<string, string>;
  memoryMb: number;
  javaMajor: number;
  gcPreset: GcPreset;
  totalSystemMb: number;
  userJvmArgs: string;
  extraJvmArgs?: string[];
  extraGameArgs?: string[];
}

export interface LaunchArgs {
  jvm: string[];
  game: string[];
  mainClass: string;
  unknownVars: string[];
}

const LEGACY_JVM: Argument[] = ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'];

function flatten(args: Argument[], env: RuleEnv): string[] {
  const out: string[] = [];
  for (const a of args) {
    if (typeof a === 'string') out.push(a);
    else if (rulesAllow(a.rules, env)) out.push(...(Array.isArray(a.value) ? a.value : [a.value]));
  }
  return out;
}

export function substitute(arg: string, vars: Record<string, string>, unknown: Set<string>): string {
  return arg.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    if (key in vars) return vars[key];
    unknown.add(key);
    return '';
  });
}

/** Drop a flag and its value (e.g. `--quickPlayMultiplayer ""`) when the substituted value came out empty. */
function dropEmptyFlagValues(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && args[i + 1] === '' ) {
      i++;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

export function buildLaunchArgs(input: LaunchArgsInput): LaunchArgs {
  const unknown = new Set<string>();
  const { version, env, vars } = input;
  const jvmTemplate = version.arguments?.jvm?.length ? version.arguments.jvm : LEGACY_JVM;
  const versionJvm = flatten(jvmTemplate, env).map((a) => substitute(a, vars, unknown));

  const mem = Math.max(512, Math.round(input.memoryMb));
  const gc = gcFlags(input.javaMajor, input.gcPreset, input.totalSystemMb);
  const preTouch = gc.includes('-XX:+AlwaysPreTouch');
  const heap = [`-Xmx${mem}M`, `-Xms${preTouch ? mem : Math.max(512, Math.floor(mem / 2))}M`];
  const user = splitArgs(input.userJvmArgs);
  const userOverridesGc = user.some((a) => /^-XX:\+Use\w+GC$/.test(a));

  const jvm = [...heap, ...(userOverridesGc ? [] : gc), ...(input.extraJvmArgs ?? []), ...user, ...versionJvm];

  let gameRaw: string[];
  if (version.arguments?.game?.length) gameRaw = flatten(version.arguments.game, env);
  else gameRaw = splitArgs(version.minecraftArguments ?? '');
  const game = dropEmptyFlagValues(gameRaw.map((a) => substitute(a, vars, unknown))).concat(input.extraGameArgs ?? []);

  return { jvm, game, mainClass: version.mainClass, unknownVars: [...unknown] };
}

export function launchVars(o: {
  username: string;
  uuid: string;
  accessToken: string;
  userType: 'msa' | 'legacy';
  xuid?: string;
  clientId?: string;
  versionName: string;
  versionType?: string;
  gameDir: string;
  assetsRoot: string;
  assetsIndex: string;
  nativesDir: string;
  librariesDir: string;
  classpath: string[];
  classpathSeparator: string;
  launcherVersion: string;
  width?: number;
  height?: number;
  quickPlayMultiplayer?: string;
  quickPlaySingleplayer?: string;
  quickPlayPath?: string;
  gameAssets?: string;
}): Record<string, string> {
  return {
    auth_player_name: o.username,
    auth_uuid: o.uuid.replace(/-/g, ''),
    auth_access_token: o.accessToken,
    auth_session: o.accessToken,
    auth_xuid: o.xuid ?? '0',
    clientid: o.clientId ?? '',
    user_type: o.userType,
    user_properties: '{}',
    version_name: o.versionName,
    version_type: o.versionType ?? 'release',
    game_directory: o.gameDir,
    assets_root: o.assetsRoot,
    game_assets: o.gameAssets ?? o.assetsRoot,
    assets_index_name: o.assetsIndex,
    natives_directory: o.nativesDir,
    library_directory: o.librariesDir,
    classpath: o.classpath.join(o.classpathSeparator),
    classpath_separator: o.classpathSeparator,
    launcher_name: 'LifeaLauncher',
    launcher_version: o.launcherVersion,
    resolution_width: String(o.width ?? 1280),
    resolution_height: String(o.height ?? 720),
    quickPlayMultiplayer: o.quickPlayMultiplayer ?? '',
    quickPlaySingleplayer: o.quickPlaySingleplayer ?? '',
    quickPlayPath: o.quickPlayPath ?? '',
    quickPlayRealms: '',
  };
}
