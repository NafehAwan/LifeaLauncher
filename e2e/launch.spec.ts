/**
 * Real Minecraft launch to the title screen (needs internet + OpenGL; run in CI via workflow_dispatch):
 *   LIFEA_LAUNCH_IT=1 xvfb-run -a npx playwright test launch
 * Vanilla 1.21.4 and the built-in Fabric profile (which also installs the performance pack from Modrinth).
 */
import { expect, test } from '@playwright/test';
import type { LaunchState, LogLine } from '../src/shared/types';
import { launch } from './app';

type Bridge = { invoke: (c: string, ...a: unknown[]) => Promise<unknown> };

test.describe.configure({ timeout: 30 * 60_000 });

for (const target of ['vanilla', 'lifea-latest'] as const) {
  test(`launches ${target} to the title screen`, async () => {
    test.skip(!process.env.LIFEA_LAUNCH_IT, 'set LIFEA_LAUNCH_IT=1 (needs network + OpenGL)');
    const { app, page } = await launch();
    await page.waitForSelector('[data-testid="app-shell"]');
    const inv = (c: string, ...a: unknown[]) => page.evaluate(([ch, args]) => (window as unknown as { lifea: Bridge }).lifea.invoke(ch as string, ...(args as unknown[])), [c, a] as const);
    await inv('accounts:add-offline', 'LifeaCI');
    let id = target as string;
    if (target === 'vanilla') id = ((await inv('instances:create', { name: 'CI vanilla', version: '1.21.4', loader: 'vanilla' })) as { id: string }).id;
    await inv('launch:start', id);
    let state: LaunchState | undefined;
    const deadline = Date.now() + 25 * 60_000;
    while (Date.now() < deadline) {
      state = ((await inv('launch:states')) as LaunchState[]).find((s) => s.instanceId === id);
      if (state && ['running', 'crashed', 'exited', 'cancelled'].includes(state.status)) break;
      await page.waitForTimeout(2000);
    }
    const logs = ((await inv('launch:logs')) as LogLine[]).filter((l) => l.instanceId === id).map((l) => l.msg);
    console.log(logs.slice(-40).join('\n'));
    expect(state?.status, state?.error ?? state?.crash?.detail).toBe('running');
    await page.waitForTimeout(20_000); // must stay alive
    state = ((await inv('launch:states')) as LaunchState[]).find((s) => s.instanceId === id);
    expect(state?.status).toBe('running');
    expect(logs.join('\n')).toMatch(/Setting user: LifeaCI|Backend library: LWJGL/);
    await inv('launch:cancel', id);
    await app.close();
  });
}
