/**
 * Pre-launch hooks for Lifea-managed profiles:
 *  - first launch of a built-in Fabric profile installs the version-correct performance pack,
 *  - the bundled lifea-core mod is copied in when a build exists for that Minecraft version,
 *  - the local bridge port/token are passed to the game as system properties.
 */
import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { instanceDir } from './core/paths';
import { addPreLaunchHook } from './game/launch';
import { bridgeInfo } from './game/bridge';
import { listContent, mutateInstance } from './game/instances';
import { optimize } from './game/modrinth';

function bundledModDirs(): string[] {
  return app.isPackaged ? [join(process.resourcesPath, 'lifea-core')] : [join(app.getAppPath(), 'mod', 'build', 'libs'), join(app.getAppPath(), 'resources', 'lifea-core')];
}

async function findCoreJar(mc: string): Promise<string | null> {
  for (const dir of bundledModDirs()) {
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const hit = files.find((f) => f.startsWith('lifea-core') && f.endsWith('.jar') && f.includes(`mc${mc}`) && !f.includes('sources'));
    if (hit) return join(dir, hit);
  }
  return null;
}

export function registerLifeaHooks(): void {
  addPreLaunchHook(async (ctx) => {
    const inst = ctx.instance;
    if (inst.loader !== 'fabric' && inst.loader !== 'quilt') return;
    const mods = await listContent(inst.id, 'mods');

    if (inst.builtin && !inst.lastPlayed && mods.filter((m) => m.source !== 'lifea').length === 0) {
      ctx.phase('installing', 'Installing performance mods (first launch)');
      const r = await optimize(inst.id, false, ctx.signal);
      ctx.log('INFO', `Performance pack: ${r.installed.map((i) => i.name).join(', ') || 'nothing new'}`);
      for (const w of r.warnings) ctx.log('WARN', w);
    }

    if (inst.builtin) {
      const jar = await findCoreJar(inst.version);
      const dest = join(instanceDir(inst.id), 'mods', 'lifea-core.jar');
      if (jar) {
        const [a, b] = await Promise.all([fs.stat(jar), fs.stat(dest).catch(() => null)]);
        if (!b || a.size !== b.size || a.mtimeMs > b.mtimeMs) {
          await fs.copyFile(jar, dest);
          await mutateInstance(inst.id, (i) => {
            i.meta['mods/lifea-core.jar'] = { name: 'Lifea Core', source: 'lifea' };
          });
        }
        ctx.log('INFO', 'Lifea Core mod enabled (Right-Shift in game).');
      } else {
        ctx.log('DEBUG', `No bundled lifea-core build for Minecraft ${inst.version}.`);
      }
    }

    const bridge = bridgeInfo();
    const hasCore = (await listContent(inst.id, 'mods')).some((m) => m.enabled && m.file === 'lifea-core.jar');
    if (bridge && hasCore) {
      ctx.extraJvmArgs.push(`-Dlifea.bridge.port=${bridge.port}`, `-Dlifea.bridge.token=${bridge.token}`, `-Dlifea.instance=${inst.id}`);
    }
  });
}
