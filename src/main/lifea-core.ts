/**
 * Pre-launch hooks for Lifea-managed profiles:
 *  - first launch of a built-in Fabric profile installs the version-correct performance pack,
 *  - bundled LifeaCore/Tuff builds are loaded only for their exact Minecraft version,
 *  - the local bridge port/token are passed to the game as system properties.
 */
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { delimiter, join } from 'node:path';
import { selectedAccount } from './accounts/store';
import { addPreLaunchHook, FatalLaunchError } from './game/launch';
import { bridgeInfo } from './game/bridge';
import { deleteContent, listContent, toggleContent } from './game/instances';
import { installProject, optimize } from './game/modrinth';
import { writeCosmeticsSync } from './game/cosmetics-sync';
import { safeJoin } from './core/fsx';
import { fabricApiMatches, findCoreJars } from './game/core-jars';
import { wardrobeDir } from './core/paths';

function bundledModDirs(): string[] {
  if (app.isPackaged) return [join(process.resourcesPath, 'lifea-core')];
  const root = app.getAppPath();
  return [
    join(root, 'mod', 'build', 'libs'),
    join(root, 'mod', 'mc1_21_11', 'build', 'libs'),
    join(root, 'mod', 'tuff-client', 'build', 'libs'),
    join(root, 'resources', 'lifea-core'),
  ];
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._+-]/g, '_');
}

export function registerLifeaHooks(): void {
  addPreLaunchHook(async (ctx) => {
    const inst = ctx.instance;
    const mods = await listContent(inst.id, 'mods');

    // Only Lifea's own profiles get the performance pack automatically; user profiles get it from Boost → Optimize.
    if (inst.builtin && !inst.lastPlayed && mods.filter((m) => m.source !== 'lifea').length === 0 && inst.loader !== 'vanilla') {
      ctx.phase('installing', 'Installing performance mods (first launch)');
      const r = await optimize(inst.id, false, ctx.signal, { releasesOnly: true });
      ctx.log('INFO', `Performance pack: ${r.installed.map((i) => i.name).join(', ') || 'nothing new'}`);
      for (const w of r.warnings) ctx.log('WARN', w);
    }

    // Only the bundled core client jars are tied to Fabric. Other loaders still
    // get their own compatible Modrinth optimization set above.
    if (inst.loader !== 'fabric' && inst.loader !== 'quilt') return;

    // Clean up the launcher-managed copy from older builds. Never remove a user-added jar.
    if (mods.some((m) => m.file === 'lifea-core.jar' && m.source === 'lifea')) {
      await deleteContent(inst.id, 'mods', ['lifea-core.jar']);
    }

    const jars = await findCoreJars(bundledModDirs(), inst.version, inst.loader, ctx.loaderVersion);
    if (inst.loader === 'fabric' && jars.length > 0) {
      // The client mods need Fabric API. Without a matching one Minecraft crashes on start, so fix it or stop here.
      const installedMods = await listContent(inst.id, 'mods');
      const fabricApis = installedMods.filter((mod) => mod.file.toLowerCase().startsWith('fabric-api'));
      const matching = fabricApis.find((mod) => fabricApiMatches(`${mod.version ?? ''} ${mod.file}`, inst.version));
      if (!matching && fabricApis.length) {
        await deleteContent(inst.id, 'mods', fabricApis.map((mod) => mod.file));
        ctx.log('WARN', `Removed Fabric API built for another Minecraft version: ${fabricApis.map((mod) => mod.file).join(', ')}`);
      }
      if (matching && !matching.enabled) {
        await toggleContent(inst.id, 'mods', matching.file, true);
        ctx.log('INFO', 'Enabled Fabric API, required by the Lifea client.');
      } else if (!matching) {
        ctx.phase('installing', 'Installing Fabric API (needed by the Lifea client)');
        try {
          const dependency = await installProject(inst.id, 'fabric-api', undefined, ctx.signal);
          ctx.log('INFO', `Fabric API installed: ${dependency.installed.map((item) => item.file).join(', ') || 'already present'}`);
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw e;
          throw new FatalLaunchError(`Could not install Fabric API, which the Lifea client needs: ${(e as Error).message}. Check your connection and try again.`);
        }
      }
    }
    if (jars.length) {
      // Keep the bundled jar outside the discoverable mods list. Fabric/Quilt expose
      // documented extra-mod properties, so no mods-folder copy is needed.
      const coreDir = join(
        app.getPath('userData'),
        'core-mods',
        inst.loader,
        safePathSegment(ctx.loaderVersion ?? 'loader-default'),
        safePathSegment(inst.version),
        safePathSegment(inst.id),
      );
      await fs.mkdir(coreDir, { recursive: true });
      const destinations: string[] = [];
      for (const jar of jars) {
        const dest = join(coreDir, jar.slice(Math.max(jar.lastIndexOf('/'), jar.lastIndexOf('\\')) + 1));
        await fs.copyFile(jar, dest);
        destinations.push(dest);
      }
      const property = inst.loader === 'quilt' ? '-Dloader.addMods=' : '-Dfabric.addMods=';
      ctx.extraJvmArgs.push(`${property}${destinations.join(delimiter)}`);
      ctx.log('INFO', `Version-matched Lifea client mods for Minecraft ${inst.version} loaded from launcher storage.`);
    } else {
      ctx.log('WARN', `The Lifea client is not available for ${inst.loader} ${inst.version} yet; starting without it.`);
    }

    if (jars.some((jar) => jar.includes('lifea-core-'))) {
      const account = await selectedAccount();
      const syncPath = await writeCosmeticsSync(inst.id, account);
      ctx.extraJvmArgs.push(`-Dlifea.cosmetics.path=${syncPath}`);
      if (account?.localSkinFile || account?.type === 'offline') {
        const localSkin = account.localSkinFile
          ? safeJoin(join(wardrobeDir(), 'skins'), account.localSkinFile)
          : app.isPackaged ? join(process.resourcesPath, 'default-skins', 'steve.png') : join(app.getAppPath(), 'resources', 'default-skins', 'steve.png');
        if (await fs.stat(localSkin).then((stat) => stat.isFile()).catch(() => false)) {
          ctx.extraJvmArgs.push(`-Dlifea.skin.path=${localSkin}`);
          ctx.extraJvmArgs.push(`-Dlifea.skin.model=${account.localSkinFile && account.skinVariant === 'slim' ? 'slim' : 'classic'}`);
        }
      }
      if (account?.localCapeFile) {
        const localCape = safeJoin(join(wardrobeDir(), 'capes'), account.localCapeFile);
        if (await fs.stat(localCape).then((stat) => stat.isFile()).catch(() => false)) {
          ctx.extraJvmArgs.push(`-Dlifea.cape.path=${localCape}`);
        }
      }
      for (const [type, cosmeticId] of Object.entries(account?.localCosmetics ?? {})) {
        if (cosmeticId && ['wings', 'hat', 'bandana'].includes(type) && /^[a-z0-9_-]{1,40}$/i.test(cosmeticId)) {
          ctx.extraJvmArgs.push(`-Dlifea.cosmetic.${type}=${cosmeticId}`);
        }
      }
    }

    const bridge = bridgeInfo();
    if (bridge && jars.some((jar) => jar.includes('lifea-core-'))) {
      ctx.extraJvmArgs.push(`-Dlifea.bridge.port=${bridge.port}`, `-Dlifea.bridge.token=${bridge.token}`, `-Dlifea.instance=${inst.id}`);
    }
  });
}
