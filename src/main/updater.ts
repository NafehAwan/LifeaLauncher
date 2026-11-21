/** Auto-update via electron-updater (GitHub Releases). Checks on start and every 6 h; installs on restart. */
import { app } from 'electron';
import type { UpdaterState } from '@shared/types';
import { emit } from './core/events';
import { log } from './core/log';
import { getSettings } from './core/settings';

let state: UpdaterState = { status: 'idle' };
let updater: typeof import('electron-updater').autoUpdater | null = null;

function set(s: UpdaterState): void {
  state = s;
  emit('updater:state', s);
}

export function updaterState(): UpdaterState {
  return state;
}

export async function initUpdater(): Promise<void> {
  if (!app.isPackaged || process.env.LIFEA_DISABLE_UPDATER) return set({ status: 'disabled' });
  try {
    const module = await import('electron-updater') as typeof import('electron-updater') & {
      default?: { autoUpdater?: typeof import('electron-updater').autoUpdater };
    };
    // electron-updater is CommonJS; depending on the production bundler, its named
    // export may be placed under `default`. Resolve both forms before configuration.
    updater = module.autoUpdater ?? module.default?.autoUpdater ?? null;
  } catch (e) {
    log.warn('electron-updater unavailable', e);
    return set({ status: 'disabled' });
  }
  if (!updater) {
    log.warn('electron-updater loaded without an autoUpdater export; update checks disabled.');
    return set({ status: 'disabled' });
  }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: (m: unknown) => log.info('[updater]', m), warn: (m: unknown) => log.warn('[updater]', m), error: (m: unknown) => log.error('[updater]', m), debug: () => undefined };
  updater.on('checking-for-update', () => set({ status: 'checking' }));
  updater.on('update-available', (i) => set({ status: 'downloading', version: i.version, progress: 0 }));
  updater.on('update-not-available', () => set({ status: 'none' }));
  updater.on('download-progress', (p) => set({ ...state, status: 'downloading', progress: p.percent / 100 }));
  updater.on('update-downloaded', (i) => set({ status: 'ready', version: i.version }));
  updater.on('error', (e) => set({ status: 'error', error: e.message }));
  if (getSettings().autoUpdate) {
    void checkForUpdates();
    setInterval(() => void checkForUpdates(), 6 * 60 * 60 * 1000).unref();
  }
}

export async function checkForUpdates(): Promise<UpdaterState> {
  if (!updater) return state;
  try {
    await updater.checkForUpdates();
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
  return state;
}

export function installUpdate(): void {
  if (state.status === 'ready') updater?.quitAndInstall();
}
