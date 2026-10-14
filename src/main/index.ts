/**
 * Electron main entry. Order matters:
 *  1. register the app:// scheme (must happen before `ready`)
 *  2. on ready: load settings (fixed userData path), create the window FIRST, then bootstrap in the background
 *  3. every bootstrap step is non-fatal and reports through `app:notice`
 */
import { app, BrowserWindow, Menu, net, safeStorage, session, shell } from 'electron';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { initLog, log } from './core/log';
import { allGameDirs, initPaths, logsDir } from './core/paths';
import { setFetch, setUserAgent } from './core/http';
import { emit, notice, setSender } from './core/events';
import { flushSettings, getSettings, loadSettings, onSettingsChange } from './core/settings';
import { ensureDir } from './core/fsx';
import { handleAppProtocol, registerSchemes } from './protocol';
import { registerIpc, setDevOrigin } from './ipc';
import { registerLifeaHooks } from './lifea-core';
import { setSecretBox, selectedAccount } from './accounts/store';
import { ensureBuiltinProfiles } from './game/instances';
import { isAnyRunning, launchStates, setLauncherVersion, setWindowHooks } from './game/launch';
import { setConcurrency } from './game/download';
import { setBridgeHandler, startBridge, stopBridge } from './game/bridge';
import { setGpuProvider } from './game/boost';
import * as social from './social/client';
import { initUpdater } from './updater';
import { updateSettings } from './core/settings';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;
let wasHiddenForGame = false;

process.on('uncaughtException', (e) => log.error('uncaughtException', e));
process.on('unhandledRejection', (e) => log.error('unhandledRejection', e));

if (process.env.LIFEA_USER_DATA) app.setPath('userData', process.env.LIFEA_USER_DATA);
registerSchemes();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(main).catch((e) => {
    log.error('fatal startup error', e);
    app.quit();
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    show: false,
    backgroundColor: '#0b0607',
    title: 'LifeaLauncher',
    icon: join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
      backgroundThrottling: true,
    },
  });
  win.once('ready-to-show', () => {
    win.show();
    log.info(`window shown after ${Math.round(performance.now())} ms`);
  });
  win.on('maximize', () => emit('window:maximized', true));
  win.on('unmaximize', () => emit('window:maximized', false));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://lifea/') && !(DEV_URL && url.startsWith(DEV_URL))) e.preventDefault();
  });
  win.webContents.on('render-process-gone', (_e, d) => log.error('renderer gone', d));
  win.webContents.setZoomFactor(getSettings().zoom);
  void win.loadURL(DEV_URL ?? 'app://lifea/index.html');
  return win;
}

async function main(): Promise<void> {
  initPaths({ userData: app.getPath('userData'), home: homedir(), gameDirSetting: () => getSettings().gameDir });
  initLog(logsDir());
  log.info(`LifeaLauncher ${app.getVersion()} (electron ${process.versions.electron}, ${process.platform}/${process.arch})`);
  const ua = `LifeaLauncher/${app.getVersion()} (github.com/nafehawan/lifealauncher)`;
  setUserAgent(ua);
  setFetch((input, init) => net.fetch(input as string, init));
  setLauncherVersion(app.getVersion());
  session.defaultSession.setUserAgent(ua);
  setSecretBox({
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
    decrypt: (s) => safeStorage.decryptString(Buffer.from(s, 'base64')),
  });
  setGpuProvider(async () => {
    try {
      const info = (await app.getGPUInfo('basic')) as { gpuDevice?: { vendorId: number; deviceId: number; active?: boolean; driverVendor?: string }[]; auxAttributes?: { glRenderer?: string } };
      return info.auxAttributes?.glRenderer || undefined;
    } catch {
      return undefined;
    }
  });
  Menu.setApplicationMenu(null);

  const loaded = await loadSettings();
  setConcurrency(getSettings().parallelDownloads);
  if (DEV_URL) setDevOrigin(new URL(DEV_URL).origin);

  setSender((channel, payload) => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload);
  });
  handleAppProtocol();
  registerIpc();
  registerLifeaHooks();

  mainWindow = createWindow();
  if (loaded.recovered) setTimeout(() => notice('warn', 'Your settings file was damaged and has been reset.', `Backup: ${loaded.recovered}`), 1500);

  onSettingsChange((s) => {
    emit('settings:changed', s);
    setConcurrency(s.parallelDownloads);
    for (const w of BrowserWindow.getAllWindows()) if (Math.abs(w.webContents.getZoomFactor() - s.zoom) > 0.001) w.webContents.setZoomFactor(s.zoom);
  });

  setWindowHooks({
    onRunning: () => {
      const behavior = getSettings().launchBehavior;
      if (!mainWindow) return;
      if (behavior === 'hide') {
        mainWindow.hide();
        wasHiddenForGame = true;
      } else if (behavior === 'minimize') mainWindow.minimize();
      const running = launchStates().find((s) => s.status === 'running');
      social.setPresence({ state: 'playing', version: running?.instanceId, since: Date.now() });
    },
    onAllExited: () => {
      if (mainWindow && wasHiddenForGame) {
        mainWindow.show();
        wasHiddenForGame = false;
      }
      social.setPresence({ state: 'launcher' });
    },
  });

  // Background bootstrap — never blocks the window, never crashes the app.
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      log.error(`bootstrap step "${name}" failed`, e);
      notice('error', `Startup step failed: ${name}`, (e as Error).message);
    }
  };
  await step('game folders', async () => Promise.all(allGameDirs().map(ensureDir)));
  await step('built-in profiles', async () => {
    if (!getSettings().onboarded) {
      await ensureBuiltinProfiles();
      updateSettings({ onboarded: true });
      emit('instances:changed', {});
    }
  });
  await step('game bridge', async () => {
    setBridgeHandler({
      configFor: async () => {
        const t = social.socialToken();
        const acc = await selectedAccount();
        return { backendUrl: t.url, token: t.token, uuid: acc?.uuid, username: acc?.username };
      },
      onPresence: (_id, server) => social.setPresence({ state: 'playing', server: server ?? undefined, since: Date.now() }),
    });
    await startBridge();
  });
  void step('social', () => social.signIn());
  void step('updater', () => initUpdater());
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isAnyRunning()) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) mainWindow = createWindow();
});

app.on('before-quit', () => {
  stopBridge();
  void flushSettings();
});
