import { test } from '@playwright/test';
import { launch } from './app';

test('diag', async () => {
  test.skip(!process.env.LIFEA_DIAG, 'diagnostics only');
  const { app, page } = await launch();
  await page.waitForSelector('[data-testid="app-shell"]');
  const cpu = async (ms: number) => {
    const s = () => app.evaluate(({ app: a }) => a.getAppMetrics().map((m) => [m.type, m.cpu.cumulativeCPUUsage ?? 0] as const));
    const a = await s();
    await new Promise((r) => setTimeout(r, ms));
    const b = await s();
    const out: Record<string, number> = {};
    b.forEach(([t, v], i) => (out[t] = +((out[t] ?? 0) + ((v - (a[i]?.[1] ?? 0)) / (ms / 1000)) * 100).toFixed(1)));
    return out;
  };
  const set = (p: object) => page.evaluate((x) => (window as any).lifea.invoke('settings:set', x), p);
  await page.waitForTimeout(2000);
  console.log('full', JSON.stringify(await cpu(4000)));
  await set({ particles: false });
  await page.waitForTimeout(800);
  console.log('no particles', JSON.stringify(await cpu(4000)));
  await page.addStyleTag({ content: '.scene-drift{animation:none!important}' });
  await page.waitForTimeout(800);
  console.log('no particles, no drift', JSON.stringify(await cpu(4000)));
  await page.addStyleTag({ content: '.scene-character{animation:none!important}' });
  await page.waitForTimeout(800);
  console.log('static', JSON.stringify(await cpu(4000)));
  console.log('gpu', JSON.stringify(await app.evaluate(({ app: a }) => a.getGPUFeatureStatus())));
  await app.close();
});
