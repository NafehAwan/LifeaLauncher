/**
 * Every ipcMain handler, each validated with zod and restricted to our own renderer origin.
 * Channel names and types come from the shared contract in src/shared/ipc.ts.
 */
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { InvokeArgs, InvokeChannel, InvokeResult } from '@shared/ipc';
import { settingsPatchSchema } from '@shared/schemas';
import { request } from './core/http';
import { logFilePath } from './core/log';
import { instanceDir } from './core/paths';
import { getSettings, updateSettings } from './core/settings';
import { emit } from './core/events';
import { addMicrosoftAccount, addOfflineAccount, listAccounts, msaAccessToken, removeAccount, updateAccountProfile } from './accounts/store';
import { interactiveMicrosoftLogin } from './accounts/msa-window';
import { msaClientId, uploadSkin } from './accounts/msa';
import { analyze } from './game/boost';
import {
  addFiles,
  createInstance,
  deleteContent,
  deleteScreenshot,
  duplicateInstance,
  listContent,
  listInstances,
  listScreenshots,
  listWorlds,
  mutateInstance,
  readInstance,
  removeInstance,
  toggleContent,
} from './game/instances';
import { listRuntimes, probeJava } from './game/java';
import { cancelLaunch, launchStates, recentLogs, startLaunch } from './game/launch';
import { listLoaderVersions } from './game/loaders/fabric';
import { listForgeVersions } from './game/loaders/forge';
import * as modrinth from './game/modrinth';
import { exportMrpack, importMrpack, installModpack } from './game/mrpack';
import { listVersions } from './game/versions';
import { importTextures, listWardrobe, removeTexture, validateTexture } from './game/wardrobe';
import { pingServer } from './servers/ping';
import { listServers, removeServer, reorderServers, saveServer } from './servers/store';
import * as social from './social/client';
import { checkForUpdates, installUpdate, updaterState } from './updater';

const id = z.string().min(1).max(128).regex(/^[\w.-]+$/);
const kind = z.enum(['mods', 'resourcepacks', 'shaderpacks']);
const fileName = z.string().min(1).max(255).refine((s) => !/[\\/]/.test(s) && s !== '..' && s !== '.', 'bad file name');
const loader = z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']);
const mcVersion = z.string().min(1).max(64);
const wardrobeKind = z.enum(['skins', 'capes']);
const cosmeticType = z.enum(['cape', 'wings', 'hat', 'bandana', 'pet', 'emote']);
const instanceSettings = z.object({
  memoryMb: z.number().int().min(512).max(65536).optional(),
  javaPath: z.string().max(1024).optional(),
  jvmArgs: z.string().max(4000).optional(),
  resolution: z.object({ width: z.number().int().min(320).max(7680), height: z.number().int().min(240).max(4320) }).optional(),
  fullscreen: z.boolean().optional(),
  preLaunchCommand: z.string().max(2000).optional(),
});

let devOrigin = '';
export function setDevOrigin(origin: string): void {
  devOrigin = origin;
}

function trusted(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  return url.startsWith('app://lifea/') || (!!devOrigin && url.startsWith(devOrigin));
}

function handle<C extends InvokeChannel>(
  channel: C,
  schema: z.ZodTypeAny,
  fn: (args: InvokeArgs<C>, e: IpcMainInvokeEvent) => Promise<InvokeResult<C>> | InvokeResult<C>,
): void {
  // z.tuple() requires every position even when trailing ones are optional, so pad omitted trailing args.
  const arity = schema instanceof z.ZodTuple ? (schema.items as unknown[]).length : 0;
  ipcMain.handle(channel, async (e, ...raw: unknown[]) => {
    if (!trusted(e)) throw new Error('Untrusted sender');
    if (raw.length > arity && arity > 0) throw new Error(`Too many arguments for ${channel}`);
    while (raw.length < arity) raw.push(undefined);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid request for ${channel}: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    return fn(parsed.data as InvokeArgs<C>, e);
  });
}

const none = z.tuple([]);
const win = (e: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender) ?? undefined;

async function pickFiles(e: IpcMainInvokeEvent, title: string, extensions: string[], multi = true): Promise<string[]> {
  const w = win(e);
  const opts: Electron.OpenDialogOptions = { title, properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters: [{ name: title, extensions }] };
  const res = w ? await dialog.showOpenDialog(w, opts) : await dialog.showOpenDialog(opts);
  return res.canceled ? [] : res.filePaths;
}

export function registerIpc(): void {
  /* app */
  handle('app:info', none, () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    gpuCompositing: app.getGPUFeatureStatus().gpu_compositing?.startsWith('enabled') ?? false,
    userData: app.getPath('userData'),
    msaConfigured: !!msaClientId(),
  }));
  handle('app:open-external', z.tuple([z.string().url()]), async ([url]) => {
    if (!/^https?:\/\//.test(url)) throw new Error('Only web links can be opened.');
    await shell.openExternal(url);
  });
  handle('app:open-logs', none, async () => {
    const f = logFilePath();
    if (f) shell.showItemInFolder(f);
  });
  handle('app:upload-log', z.tuple([z.string().max(10_000_000)]), async ([text]) => {
    const res = await request('https://api.mclo.gs/1/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ content: text }).toString(),
    });
    const j = (await res.json()) as { success: boolean; url?: string; error?: string };
    if (!j.success || !j.url) throw new Error(j.error ?? 'Upload failed');
    return j.url;
  });
  handle('app:copy', z.tuple([z.string().max(10_000_000)]), ([t]) => clipboard.writeText(t));

  /* window */
  handle('window:minimize', none, (_a, e) => win(e)?.minimize());
  handle('window:toggle-maximize', none, (_a, e) => {
    const w = win(e);
    if (!w) return false;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
    return w.isMaximized();
  });
  handle('window:close', none, (_a, e) => win(e)?.close());
  handle('window:is-maximized', none, (_a, e) => win(e)?.isMaximized() ?? false);

  /* settings */
  handle('settings:get', none, () => getSettings());
  handle('settings:set', z.tuple([settingsPatchSchema]), ([patch]) => updateSettings(patch));

  /* instances */
  handle('instances:list', none, () => listInstances());
  handle('instances:get', z.tuple([id]), ([i]) => readInstance(i));
  handle('instances:create', z.tuple([z.object({ name: z.string().max(64), version: mcVersion, loader, loaderVersion: z.string().max(64).optional(), icon: z.string().max(32).optional() })]), async ([input]) => {
    const inst = await createInstance(input);
    emit('instances:changed', { id: inst.id });
    return inst;
  });
  handle(
    'instances:update',
    z.tuple([id, z.object({ name: z.string().min(1).max(64).optional(), icon: z.string().max(32).optional(), version: mcVersion.optional(), loader: loader.optional(), loaderVersion: z.string().max(64).optional(), settings: instanceSettings.optional() })]),
    async ([i, patch]) => {
      const inst = await mutateInstance(i, (x) => {
        if (patch.version && patch.version !== x.version) x.loaderVersion = undefined;
        if (patch.loader && patch.loader !== x.loader) x.loaderVersion = undefined;
        Object.assign(x, { ...patch, settings: patch.settings ? { ...x.settings, ...patch.settings } : x.settings });
      });
      emit('instances:changed', { id: i });
      return inst;
    },
  );
  handle('instances:duplicate', z.tuple([id]), async ([i]) => {
    const inst = await duplicateInstance(i);
    emit('instances:changed', { id: inst.id });
    return inst;
  });
  handle('instances:remove', z.tuple([id]), async ([i]) => {
    if (launchStates().some((s) => s.instanceId === i && ['preparing', 'downloading', 'installing', 'launching', 'running'].includes(s.status))) {
      throw new Error('Stop the game before deleting this profile.');
    }
    await removeInstance(i);
    if (getSettings().selectedInstanceId === i) updateSettings({ selectedInstanceId: (await listInstances())[0]?.id });
    emit('instances:changed', {});
  });
  handle('instances:open-folder', z.tuple([id, z.enum(['mods', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs', 'config', 'crash-reports']).optional()]), async ([i, sub]) => {
    if (!(await readInstance(i))) throw new Error('Profile not found.');
    const p = sub ? join(instanceDir(i), sub) : instanceDir(i);
    await fs.mkdir(p, { recursive: true });
    const err = await shell.openPath(p);
    if (err) throw new Error(err);
  });
  handle('instances:content', z.tuple([id, kind]), ([i, k]) => listContent(i, k));
  handle('instances:toggle-content', z.tuple([id, kind, fileName, z.boolean()]), ([i, k, f, en]) => toggleContent(i, k, f, en));
  handle('instances:delete-content', z.tuple([id, kind, z.array(fileName).max(1000)]), async ([i, k, files]) => {
    await deleteContent(i, k, files);
    emit('instances:changed', { id: i });
  });
  handle('instances:add-files', z.tuple([id, kind, z.array(z.string().max(4096)).max(500).optional()]), async ([i, k, paths], e) => {
    const list = paths?.length ? paths : await pickFiles(e, k === 'mods' ? 'Mods' : k === 'resourcepacks' ? 'Resource packs' : 'Shader packs', k === 'mods' ? ['jar'] : ['zip']);
    const added = await addFiles(i, k, list);
    emit('instances:changed', { id: i });
    return added;
  });
  handle('instances:worlds', z.tuple([id]), ([i]) => listWorlds(i));
  handle('instances:screenshots', z.tuple([id.optional()]), ([i]) => listScreenshots(i));
  handle('instances:delete-screenshot', z.tuple([id, fileName]), ([i, f]) => deleteScreenshot(i, f));
  handle('instances:export-mrpack', z.tuple([id]), async ([i], e) => {
    const inst = await readInstance(i);
    if (!inst) throw new Error('Profile not found.');
    const w = win(e);
    const opts: Electron.SaveDialogOptions = { title: 'Export modpack', defaultPath: `${inst.name.replace(/[^\w .-]+/g, '_')}.mrpack`, filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }] };
    const res = w ? await dialog.showSaveDialog(w, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return null;
    return exportMrpack(i, res.filePath);
  });
  handle('instances:import-mrpack', z.tuple([z.string().max(4096).optional()]), async ([path], e) => {
    const file = path ?? (await pickFiles(e, 'Modrinth modpack', ['mrpack'], false))[0];
    if (!file) return null;
    const inst = await importMrpack(file);
    emit('instances:changed', { id: inst.id });
    return inst;
  });

  /* versions */
  handle('versions:list', z.tuple([z.boolean()]), ([snap]) => listVersions(snap));
  handle('versions:loaders', z.tuple([mcVersion]), async ([mc]) => {
    const [fabric, quilt, forge, neoforge] = await Promise.all([
      listLoaderVersions('fabric', mc),
      listLoaderVersions('quilt', mc),
      listForgeVersions('forge', mc),
      listForgeVersions('neoforge', mc),
    ]);
    return { vanilla: true, fabric, quilt, forge, neoforge };
  });

  /* launch */
  handle('launch:start', z.tuple([id, z.object({ server: z.string().max(255).optional(), world: z.string().max(255).optional() }).optional()]), ([i, opts]) => {
    startLaunch(i, opts);
    updateSettings({ selectedInstanceId: i });
  });
  handle('launch:cancel', z.tuple([id]), ([i]) => cancelLaunch(i));
  handle('launch:states', none, () => launchStates());
  handle('launch:logs', none, () => recentLogs());

  /* java */
  handle('java:list', none, () => listRuntimes());
  handle('java:probe', z.tuple([z.string().min(1).max(4096)]), ([p]) => probeJava(p));
  handle('java:pick', none, async (_a, e) => (await pickFiles(e, 'Java executable', process.platform === 'win32' ? ['exe'] : ['*'], false))[0] ?? null);

  /* modrinth */
  handle(
    'modrinth:search',
    z.tuple([z.object({ query: z.string().max(200), type: z.enum(['mod', 'modpack', 'resourcepack', 'shader']), loader: z.string().max(32).optional(), gameVersion: z.string().max(64).optional(), categories: z.array(z.string().max(64)).max(10).optional(), sort: z.enum(['relevance', 'downloads', 'follows', 'newest', 'updated']), offset: z.number().int().min(0).max(10000), limit: z.number().int().min(1).max(100).optional() })]),
    ([q]) => modrinth.search(q),
  );
  handle('modrinth:project', z.tuple([z.string().min(1).max(128)]), ([p]) => modrinth.getProject(p));
  handle('modrinth:versions', z.tuple([z.string().min(1).max(128), z.object({ gameVersion: z.string().max(64).optional(), loader: z.string().max(32).optional() }).optional()]), ([p, f]) =>
    modrinth.getVersions(p, { gameVersion: f?.gameVersion, loaders: f?.loader ? [f.loader] : undefined }),
  );
  handle('modrinth:install', z.tuple([id, z.string().min(1).max(128), z.string().max(128).optional()]), async ([i, p, v]) => {
    const r = await modrinth.installProject(i, p, v);
    emit('instances:changed', { id: i });
    return r;
  });
  handle('modrinth:install-modpack', z.tuple([z.string().min(1).max(128), z.string().max(128).optional()]), async ([p, v]) => {
    const inst = await installModpack(p, v);
    emit('instances:changed', { id: inst.id });
    return inst;
  });
  handle('modrinth:check-updates', z.tuple([id]), ([i]) => modrinth.checkUpdates(i));
  handle(
    'modrinth:apply-updates',
    z.tuple([id, z.array(z.object({ file: fileName, kind, name: z.string(), from: z.string(), to: z.string(), versionId: z.string().max(128) })).max(500)]),
    async ([i, u]) => {
      const r = await modrinth.applyUpdates(i, u);
      emit('instances:changed', { id: i });
      return r;
    },
  );
  handle('modrinth:optimize', z.tuple([id, z.boolean()]), async ([i, dry]) => {
    const r = await modrinth.optimize(i, dry);
    if (!dry) emit('instances:changed', { id: i });
    return r;
  });

  /* servers */
  handle('servers:list', none, () => listServers());
  handle('servers:save', z.tuple([z.object({ id: z.string().max(64).optional(), name: z.string().max(64), address: z.string().min(1).max(255) })]), ([s]) => saveServer(s));
  handle('servers:remove', z.tuple([z.string().max(64)]), ([i]) => removeServer(i));
  handle('servers:reorder', z.tuple([z.array(z.string().max(64)).max(500)]), ([ids]) => reorderServers(ids));
  handle('servers:ping', z.tuple([z.string().min(1).max(255)]), ([a]) => pingServer(a));

  /* accounts */
  handle('accounts:list', none, () => listAccounts());
  handle('accounts:select', z.tuple([z.string().uuid()]), async ([i]) => {
    updateSettings({ selectedAccountId: i });
    social.signOut();
    void social.signIn();
  });
  handle('accounts:add-offline', z.tuple([z.string().max(16)]), async ([n]) => addOfflineAccount(n));
  handle('accounts:login-microsoft', none, async (_a, e) => {
    const { tokens, session } = await interactiveMicrosoftLogin(win(e));
    const acc = await addMicrosoftAccount(tokens, session);
    void social.signIn();
    return acc;
  });
  handle('accounts:remove', z.tuple([z.string().uuid()]), ([i]) => removeAccount(i));
  handle('accounts:upload-skin', z.tuple([z.string().uuid(), z.enum(['classic', 'slim']), z.string().max(4096).optional()]), async ([accId, variant, path], e) => {
    const file = path ?? (await pickFiles(e, 'Skin', ['png'], false))[0];
    if (!file) throw new Error('No skin selected.');
    const png = await fs.readFile(file);
    const err = validateTexture('skins', png);
    if (err) throw new Error(err);
    const profile = await uploadSkin(await msaAccessToken(accId), png, variant);
    const active = profile.skins?.find((s) => s.state === 'ACTIVE');
    return updateAccountProfile(accId, { skinUrl: active?.url, skinVariant: variant });
  });

  /* wardrobe */
  handle('wardrobe:list', z.tuple([wardrobeKind]), ([k]) => listWardrobe(k));
  handle('wardrobe:import', z.tuple([wardrobeKind]), async ([k], e) => importTextures(k, await pickFiles(e, k === 'skins' ? 'Skins' : 'Capes', ['png'])));
  handle('wardrobe:remove', z.tuple([wardrobeKind, fileName]), ([k, f]) => removeTexture(k, f));

  /* boost */
  handle('boost:analyze', z.tuple([id]), ([i]) => analyze(i));

  /* social */
  handle('social:status', none, () => social.socialStatus());
  handle('social:connect', none, () => social.signIn());
  handle('social:friends', none, () => social.friends());
  handle('social:requests', none, () => social.requests());
  handle('social:send-request', z.tuple([z.string().regex(/^[A-Za-z0-9_]{3,16}$/)]), ([u]) => social.sendRequest(u));
  handle('social:respond', z.tuple([z.string().max(64), z.boolean()]), ([r, a]) => social.respond(r, a));
  handle('social:remove-friend', z.tuple([z.string().max(64)]), ([u]) => social.removeFriend(u));
  handle('social:messages', z.tuple([z.string().max(64)]), ([u]) => social.messages(u));
  handle('social:send-message', z.tuple([z.string().max(64), z.string().min(1).max(1000)]), ([u, b]) => social.sendMessage(u, b));
  handle('social:catalog', none, () => social.catalog());
  handle('social:equipped', none, () => social.equipped());
  handle('social:equip', z.tuple([cosmeticType, z.string().max(64).nullable()]), ([t, i]) => social.equip(t, i));
  handle('social:news', none, () => social.news());
  handle('social:featured', none, () => social.featured());

  /* updater */
  handle('updater:state', none, () => updaterState());
  handle('updater:check', none, () => checkForUpdates());
  handle('updater:install', none, () => installUpdate());
}
