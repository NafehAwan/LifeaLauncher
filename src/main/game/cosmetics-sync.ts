import { app } from 'electron';
import { join } from 'node:path';
import type { Account } from '@shared/types';
import { safeJoin, writeJsonAtomic } from '../core/fsx';
import { instanceDir, wardrobeDir } from '../core/paths';

/** Per-instance offline bridge consumed by LifeaCore while the game is running. */
export function cosmeticsSyncPath(instanceId: string): string {
  if (!/^[\w.-]{1,128}$/.test(instanceId)) throw new Error('Invalid instance id for cosmetics sync.');
  return safeJoin(instanceDir(instanceId), 'lifeacore', 'cosmetics.json');
}

/** Account data remains canonical in accounts.json; this atomically writes its runtime projection. */
export async function writeCosmeticsSync(instanceId: string, account: Account | null): Promise<string> {
  const skinPath = account?.localSkinFile
    ? safeJoin(join(wardrobeDir(), 'skins'), account.localSkinFile)
    : account?.type === 'offline'
      ? app.isPackaged ? join(process.resourcesPath, 'default-skins', 'steve.png') : join(app.getAppPath(), 'resources', 'default-skins', 'steve.png')
      : undefined;
  const capePath = account?.localCapeFile ? safeJoin(join(wardrobeDir(), 'capes'), account.localCapeFile) : undefined;
  const path = cosmeticsSyncPath(instanceId);
  await writeJsonAtomic(path, {
    formatVersion: 1,
    accountId: account?.id ?? null,
    uuid: account?.uuid ?? null,
    username: account?.username ?? null,
    skinPath,
    skinVariant: account?.skinVariant === 'slim' ? 'slim' : 'classic',
    capePath,
    cosmetics: account?.localCosmetics ?? {},
  });
  return path;
}
