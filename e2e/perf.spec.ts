/** Performance budget checks against the running app. Numbers are printed so they can be recorded in WORKLOG.md. */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './app';

async function cpuPercent(app: Awaited<ReturnType<typeof launch>>['app'], ms: number): Promise<number> {
  const sample = () =>
    app.evaluate(({ app: a }) => a.getAppMetrics().reduce((sum, m) => sum + m.cpu.cumulativeCPUUsage!, 0));
  const t0 = Date.now();
  const c0 = await sample();
  await new Promise((r) => setTimeout(r, ms));
  const c1 = await sample();
  return ((c1 - c0) / ((Date.now() - t0) / 1000)) * 100;
}

test('startup, idle CPU and memory budgets', async () => {
  // First launch on a fresh machine/runner pays for a cold disk cache; budgets apply to a normal (warm) start.
  const c0 = Date.now();
  const cold = await launch();
  await cold.page.waitForSelector('[data-testid="app-shell"]');
  console.log(JSON.stringify({ coldInteractiveMs: Date.now() - c0 }));
  await cold.app.close();

  const t0 = Date.now();
  const { app, page, userData } = await launch(cold.userData);
  await page.waitForSelector('[data-testid="app-shell"]');
  const interactive = Date.now() - t0;
  await expect(page.getByTestId('background')).toHaveAttribute('data-ready', '5', { timeout: 10_000 });
  const log = readFileSync(join(userData, 'logs', 'main.log'), 'utf8');
  const shown = Number([...log.matchAll(/window shown after (\d+) ms/g)].at(-1)?.[1] ?? NaN);

  await page.waitForTimeout(1500);
  const homeCpu = await cpuPercent(app, 5000);

  await page.evaluate(() => (location.hash = '#/library'));
  await page.waitForTimeout(1000);
  const libraryCpu = await cpuPercent(app, 4000);

  const memMb = await app.evaluate(({ app: a }) => a.getAppMetrics().reduce((s, m) => s + m.memory.workingSetSize, 0) / 1024);

  console.log(JSON.stringify({ windowShownMs: shown, interactiveMs: interactive, homeIdleCpuPct: +homeCpu.toFixed(2), libraryIdleCpuPct: +libraryCpu.toFixed(2), workingSetMb: Math.round(memMb) }));
  await app.close();

  expect(shown).toBeLessThan(1500);
  expect(homeCpu).toBeLessThan(5);
  expect(libraryCpu).toBeLessThan(3);
});
