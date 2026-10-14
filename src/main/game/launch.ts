/**
 * Launch orchestrator: one LaunchJob per profile with a real state machine, cancel in every phase, batched logs,
 * crash diagnosis (fixes P0-6…P0-10, P1-6, P1-7, P1-8).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, promises as fs, type WriteStream } from 'node:fs';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Instance, LaunchState, LaunchStatus, LogLevel, LogLine } from '@shared/types';
import { emit } from '../core/events';
import { abortError, isAbort } from '../core/http';
import { log } from '../core/log';
import { assetsDir, instanceDir, librariesDir } from '../core/paths';
import { getSettings } from '../core/settings';
import { launchSession, type LaunchSession } from '../accounts/store';
import { buildLaunchArgs, launchVars, recommendMemoryMb } from './args';
import { assetTasks, loadAssetIndex, materializeLegacyAssets } from './assets';
import { cleanLogLine, diagnoseCrash, parseLevel, RUNNING_RE } from './crash';
import { downloadAll, type Progress } from './download';
import { readInstance, recordPlaytime } from './instances';
import { ensureJava, probeJava } from './java';
import { installLoaderProfile } from './loaders/fabric';
import { installForgeLike } from './loaders/forge';
import { extractNatives } from './natives';
import { buildClasspath, planLibraries } from './resolve';
import { currentEnv } from './rules';
import { clientJarPath, clientJarTask, loadVersionJson, nativesDirFor, resolveVersion } from './versions';
import type { VersionJson } from './mojang';

export interface LaunchContext {
  instance: Instance;
  version: VersionJson;
  javaMajor: number;
  signal: AbortSignal;
  log: (level: LogLevel, msg: string) => void;
  phase: (status: LaunchStatus, phase: string, p?: Progress) => void;
  extraJvmArgs: string[];
}

type PreLaunchHook = (ctx: LaunchContext) => Promise<void>;
const preLaunchHooks: PreLaunchHook[] = [];
export function addPreLaunchHook(h: PreLaunchHook): void {
  preLaunchHooks.push(h);
}

interface WindowHooks {
  onRunning(): void;
  onAllExited(): void;
}
let windowHooks: WindowHooks = { onRunning: () => undefined, onAllExited: () => undefined };
export function setWindowHooks(h: WindowHooks): void {
  windowHooks = h;
}

let launcherVersion = '0.0.0';
export function setLauncherVersion(v: string): void {
  launcherVersion = v;
}

/* ---------------- logs (batched, ring-buffered) ---------------- */
const ring: LogLine[] = [];
let pending: LogLine[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function pushLog(line: LogLine): void {
  ring.push(line);
  const max = getSettings().maxLogLines;
  if (ring.length > max) ring.splice(0, ring.length - max);
  pending.push(line);
  if (!flushTimer) flushTimer = setTimeout(flushLogs, 50);
}

function flushLogs(): void {
  flushTimer = null;
  while (pending.length) emit('launch:logs', pending.splice(0, 500));
  pending = [];
}

export function recentLogs(): LogLine[] {
  return ring.slice();
}

/* ---------------- jobs ---------------- */
const ACTIVE: LaunchStatus[] = ['preparing', 'downloading', 'installing', 'launching', 'running'];

class LaunchJob {
  state: LaunchState;
  controller = new AbortController();
  child?: ChildProcess;
  tail: string[] = [];
  file?: WriteStream;

  constructor(readonly instanceId: string) {
    this.state = {
      instanceId,
      status: 'preparing',
      phase: 'Preparing',
      progress: 0,
      filesDone: 0,
      filesTotal: 0,
      bytesDone: 0,
      bytesTotal: 0,
      speedBps: 0,
      etaSec: 0,
      startedAt: Date.now(),
    };
  }

  get active(): boolean {
    return ACTIVE.includes(this.state.status);
  }

  set(patch: Partial<LaunchState>): void {
    this.state = { ...this.state, ...patch };
    emit('launch:state', this.state);
  }

  phase(status: LaunchStatus, phase: string, p?: Progress): void {
    if (!this.active) return;
    const progress = p ? (p.bytesTotal > 0 ? p.bytesDone / p.bytesTotal : p.filesTotal > 0 ? p.filesDone / p.filesTotal : 0) : 0;
    this.set({
      status,
      phase,
      progress: Math.max(0, Math.min(1, progress)),
      filesDone: p?.filesDone ?? 0,
      filesTotal: p?.filesTotal ?? 0,
      bytesDone: p?.bytesDone ?? 0,
      bytesTotal: p?.bytesTotal ?? 0,
      speedBps: p?.speedBps ?? 0,
      etaSec: p?.etaSec ?? 0,
    });
  }

  log(level: LogLevel, msg: string, src: LogLine['src'] = 'launcher'): void {
    pushLog({ ts: Date.now(), level, msg, src, instanceId: this.instanceId });
    this.file?.write(`[${new Date().toISOString()}] [${level}] ${msg}\n`);
    if (src === 'game') {
      this.tail.push(msg);
      if (this.tail.length > 300) this.tail.shift();
    }
  }
}

const jobs = new Map<string, LaunchJob>();

export function launchStates(): LaunchState[] {
  return [...jobs.values()].map((j) => j.state);
}

export function isAnyRunning(): boolean {
  return [...jobs.values()].some((j) => j.active);
}

export function startLaunch(instanceId: string, opts: { server?: string; world?: string } = {}): void {
  const existing = jobs.get(instanceId);
  if (existing?.active) throw new Error('This profile is already running.');
  const job = new LaunchJob(instanceId);
  jobs.set(instanceId, job);
  job.set({});
  void run(job, opts).catch((e) => {
    if (isAbort(e) || job.controller.signal.aborted) {
      job.log('WARN', 'Launch cancelled.');
      job.set({ status: 'cancelled', phase: 'Cancelled' });
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('launch failed', e);
      job.log('ERROR', msg);
      job.set({ status: 'crashed', phase: 'Failed', error: msg, crash: { title: 'Could not start Minecraft', detail: msg } });
    }
    finishJob(job);
  });
}

export function cancelLaunch(instanceId: string): void {
  const job = jobs.get(instanceId);
  if (!job?.active) return;
  job.log('WARN', 'Stopping…');
  job.controller.abort();
  const child = job.child;
  if (child && child.exitCode === null) {
    child.kill();
    setTimeout(() => {
      if (child.exitCode !== null || child.pid === undefined) return;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill('SIGKILL');
    }, 5000);
  }
}

function finishJob(job: LaunchJob): void {
  job.file?.end();
  job.file = undefined;
  flushLogs();
  if (!isAnyRunning()) windowHooks.onAllExited();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

async function resolveJava(inst: Instance, major: number, component: string | undefined, job: LaunchJob): Promise<string> {
  const override = inst.settings.javaPath || getSettings().javaOverrides[String(major)];
  if (override) {
    const probed = await probeJava(override);
    if (probed && probed.major === major) return override;
    job.log('WARN', probed ? `Custom Java is ${probed.major}, but Minecraft ${inst.version} needs Java ${major}. Using a managed Java ${major} instead.` : `Custom Java at ${override} does not work. Using a managed runtime instead.`);
  }
  return ensureJava(major, component, {
    signal: job.controller.signal,
    onProgress: (p) => job.phase('downloading', `Downloading Java ${major}`, p),
  });
}

async function run(job: LaunchJob, opts: { server?: string; world?: string }): Promise<void> {
  const signal = job.controller.signal;
  const inst = await readInstance(job.instanceId);
  if (!inst) throw new Error('Profile not found.');
  const settings = getSettings();
  const dir = instanceDir(inst.id);
  await fs.mkdir(join(dir, 'logs'), { recursive: true });
  job.file = createWriteStream(join(dir, 'logs', `launcher-${new Date().toISOString().replace(/[:.]/g, '-')}.log`));
  job.log('INFO', `Launching ${inst.name} (${inst.loader} ${inst.version})`);

  const session: LaunchSession = await launchSession();
  job.log('INFO', `Account: ${session.username} (${session.userType === 'msa' ? 'Microsoft' : 'offline'})`);

  job.phase('preparing', 'Resolving version');
  const vanilla = await loadVersionJson(inst.version);
  throwIfAborted(signal);
  const javaMajor = vanilla.javaVersion?.majorVersion ?? 8;
  const java = await resolveJava(inst, javaMajor, vanilla.javaVersion?.component, job);
  job.log('INFO', `Java ${javaMajor}: ${java}`);
  throwIfAborted(signal);

  let versionId = inst.version;
  if (inst.loader === 'fabric' || inst.loader === 'quilt') {
    job.phase('installing', `Installing ${inst.loader === 'fabric' ? 'Fabric' : 'Quilt'}`);
    const r = await installLoaderProfile(inst.loader, inst.version, inst.loaderVersion);
    versionId = r.id;
    job.log('INFO', `${inst.loader} loader ${r.loader}`);
  } else if (inst.loader === 'forge' || inst.loader === 'neoforge') {
    job.phase('installing', `Installing ${inst.loader === 'forge' ? 'Forge' : 'NeoForge'} (first launch only)`);
    const r = await installForgeLike(inst.loader, inst.version, inst.loaderVersion, java, {
      signal,
      onLine: (l) => job.log('DEBUG', `[installer] ${l}`),
    });
    versionId = r.id;
  }
  throwIfAborted(signal);

  const version = await resolveVersion(versionId);
  const features = {
    has_custom_resolution: !!inst.settings.resolution,
    is_demo_user: false,
    is_quick_play_multiplayer: !!opts.server,
    is_quick_play_singleplayer: !!opts.world,
    has_quick_plays_support: false,
    is_quick_play_realms: false,
  };
  const env = currentEnv(features);
  const plan = planLibraries(version, env, librariesDir());
  const client = clientJarTask(version);
  if (!client) throw new Error(`Version ${version.id} has no client download.`);
  const { id: assetId, index } = await loadAssetIndex(version);
  throwIfAborted(signal);

  job.log('INFO', `Checking ${plan.downloads.length} libraries and ${Object.keys(index.objects).length} assets…`);
  const t0 = Date.now();
  const res = await downloadAll([client, ...plan.downloads, ...assetTasks(index)], {
    signal,
    onProgress: (p) => job.phase('downloading', p.bytesTotal > 0 ? 'Downloading game files' : 'Checking game files', p),
  });
  job.log('INFO', `Game files ready (${res.downloaded} downloaded, ${res.skipped} cached) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  job.phase('launching', 'Preparing natives');
  const nativesDir = nativesDirFor(version.id);
  await extractNatives(plan.natives, nativesDir);
  const legacyAssets = await materializeLegacyAssets(assetId, index, dir);

  const ctx: LaunchContext = {
    instance: inst,
    version,
    javaMajor,
    signal,
    log: (l, m) => job.log(l, m),
    phase: (s, ph, p) => job.phase(s, ph, p),
    extraJvmArgs: [],
  };
  for (const hook of preLaunchHooks) {
    try {
      await hook(ctx);
    } catch (e) {
      if (isAbort(e)) throw e;
      job.log('WARN', `Pre-launch step failed: ${(e as Error).message}`);
    }
  }
  throwIfAborted(signal);

  if (inst.settings.preLaunchCommand?.trim()) {
    job.log('INFO', `Running pre-launch command: ${inst.settings.preLaunchCommand}`);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(inst.settings.preLaunchCommand!, { shell: true, cwd: dir, windowsHide: true });
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`Pre-launch command exited with ${c}`))));
      p.on('error', reject);
    });
  }

  const totalMb = Math.round(totalmem() / 1024 / 1024);
  const classpath = buildClasspath(plan, clientJarPath(version.jar ?? version.id));
  const sep = process.platform === 'win32' ? ';' : ':';
  const vars = launchVars({
    username: session.username,
    uuid: session.uuid,
    accessToken: session.accessToken,
    userType: session.userType,
    versionName: version.id,
    versionType: 'LifeaLauncher',
    gameDir: dir,
    assetsRoot: assetsDir(),
    gameAssets: legacyAssets ?? assetsDir(),
    assetsIndex: assetId,
    nativesDir,
    librariesDir: librariesDir(),
    classpath,
    classpathSeparator: sep,
    launcherVersion,
    width: inst.settings.resolution?.width,
    height: inst.settings.resolution?.height,
    quickPlayMultiplayer: opts.server,
    quickPlaySingleplayer: opts.world,
  });
  const memoryMb = inst.settings.memoryMb ?? settings.defaultMemoryMb ?? recommendMemoryMb(totalMb);
  const args = buildLaunchArgs({
    version,
    env,
    vars,
    memoryMb,
    javaMajor,
    gcPreset: settings.gcPreset,
    totalSystemMb: totalMb,
    userJvmArgs: inst.settings.jvmArgs ?? settings.defaultJvmArgs,
    extraJvmArgs: ctx.extraJvmArgs,
    extraGameArgs: inst.settings.fullscreen ? ['--fullscreen'] : [],
  });
  for (const u of args.unknownVars) job.log('WARN', `Unknown launch variable \${${u}} left empty`);
  // Old versions (no quick play support) still get --server for direct join.
  if (opts.server && !version.arguments?.game) {
    const [host, port] = opts.server.split(':');
    args.game.push('--server', host, '--port', port ?? '25565');
  }
  job.log('DEBUG', `Main class: ${args.mainClass}`);
  job.log('DEBUG', `Memory: ${memoryMb} MB, classpath entries: ${classpath.length}`);
  throwIfAborted(signal);

  job.phase('launching', 'Starting Minecraft');
  const child = spawn(java, [...args.jvm, args.mainClass, ...args.game], {
    cwd: dir,
    windowsHide: true,
    env: { ...process.env, JAVA_TOOL_OPTIONS: undefined, _JAVA_OPTIONS: undefined } as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  job.child = child;

  let runningAt = 0;
  const markRunning = () => {
    if (runningAt) return;
    runningAt = Date.now();
    job.set({ status: 'running', phase: 'Playing', progress: 1, runningSince: runningAt });
    windowHooks.onRunning();
  };
  const runningTimer = setTimeout(markRunning, 15000);

  for (const stream of [child.stdout!, child.stderr!]) {
    createInterface({ input: stream }).on('line', (raw) => {
      const line = cleanLogLine(raw);
      if (line === null || line === '') return;
      job.log(parseLevel(line), line, 'game');
      if (!runningAt && RUNNING_RE.test(line)) markRunning();
    });
  }

  const exit = await new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.on('error', (error) => resolve({ code: -1, error }));
    child.on('exit', (code) => resolve({ code }));
  });
  clearTimeout(runningTimer);
  job.child = undefined;
  await recordPlaytime(inst.id, runningAt || job.state.startedAt);

  if (exit.error) throw new Error(`Could not start Java: ${exit.error.message}`);
  if (signal.aborted) {
    job.log('WARN', 'Minecraft was stopped.');
    job.set({ status: 'cancelled', phase: 'Stopped', exitCode: exit.code });
  } else if (exit.code === 0) {
    job.log('SUCCESS', 'Minecraft closed normally.');
    job.set({ status: 'exited', phase: 'Closed', exitCode: 0 });
  } else {
    const report = await newestCrashReport(dir, job.state.startedAt);
    const crash = diagnoseCrash(job.tail, report) ?? { title: 'Minecraft crashed', detail: `Exit code ${exit.code}. Check the console for details.` };
    job.log('ERROR', `Minecraft exited with code ${exit.code}: ${crash.title}`);
    job.set({ status: 'crashed', phase: 'Crashed', exitCode: exit.code, crash });
  }
  finishJob(job);
}

async function newestCrashReport(dir: string, since: number): Promise<string | undefined> {
  const cr = join(dir, 'crash-reports');
  const files = await fs.readdir(cr).catch(() => [] as string[]);
  let best: { f: string; t: number } | null = null;
  for (const f of files) {
    const st = await fs.stat(join(cr, f)).catch(() => null);
    if (st && st.mtimeMs >= since - 1000 && (!best || st.mtimeMs > best.t)) best = { f, t: st.mtimeMs };
  }
  return best ? fs.readFile(join(cr, best.f), 'utf8').catch(() => undefined) : undefined;
}
