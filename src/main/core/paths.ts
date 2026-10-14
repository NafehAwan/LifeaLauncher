/**
 * Path layout. `userData` holds launcher state (settings, accounts, logs) at a fixed location that never depends on
 * settings (fixes P0-1). `gameDir` holds game data and may be moved by the user.
 */
import { join } from 'node:path';

let userDataDir = '';
let homeDir = '';
let gameDirOverride: () => string = () => '';

export function initPaths(opts: { userData: string; home: string; gameDirSetting: () => string }): void {
  userDataDir = opts.userData;
  homeDir = opts.home;
  gameDirOverride = opts.gameDirSetting;
}

export const userData = () => userDataDir;
export const settingsFile = () => join(userDataDir, 'settings.json');
export const accountsFile = () => join(userDataDir, 'accounts.json');
export const serversFile = () => join(userDataDir, 'servers.json');
export const logsDir = () => join(userDataDir, 'logs');

export function gameDir(): string {
  const custom = gameDirOverride();
  return custom && custom.trim() ? custom : join(homeDir, '.lifea');
}

export const instancesDir = () => join(gameDir(), 'instances');
export const instanceDir = (id: string) => join(instancesDir(), id);
export const versionsDir = () => join(gameDir(), 'versions');
export const librariesDir = () => join(gameDir(), 'libraries');
export const assetsDir = () => join(gameDir(), 'assets');
export const runtimesDir = () => join(gameDir(), 'runtimes');
export const cacheDir = () => join(gameDir(), 'cache');
export const wardrobeDir = () => join(gameDir(), 'wardrobe');

export function allGameDirs(): string[] {
  return [gameDir(), instancesDir(), versionsDir(), librariesDir(), assetsDir(), runtimesDir(), cacheDir(), join(wardrobeDir(), 'skins'), join(wardrobeDir(), 'capes')];
}
