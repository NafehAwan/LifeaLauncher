/** Launcher ↔ backend integration: starts the real server, signs in with an offline account, checks Friends/cosmetics. */
import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { launch } from './app';

let server: ChildProcess;
const PORT = 18787;

test.beforeAll(async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', 'src/index.ts'], {
    cwd: join(__dirname, '..', 'server'),
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', JWT_SECRET: 'e2e'.repeat(12), ALLOW_OFFLINE: '1', SQLITE_FILE: ':memory:', PUBLIC_URL: `http://127.0.0.1:${PORT}` },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('backend did not start');
});
test.afterAll(() => server?.kill());

test('signs in to the Lifea backend and shows cosmetics', async () => {
  const { app, page } = await launch();
  await page.waitForSelector('[data-testid="app-shell"]');
  await page.evaluate(() => (window as unknown as { lifea: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).lifea.invoke('accounts:add-offline', 'SocialTester'));
  await page.evaluate((url) => (window as unknown as { lifea: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).lifea.invoke('settings:set', { backendUrl: url }), `http://127.0.0.1:${PORT}`);
  const status = (await page.evaluate(() => (window as unknown as { lifea: { invoke: (c: string) => Promise<{ signedIn: boolean; connected: boolean }> } }).lifea.invoke('social:connect'))) as { signedIn: boolean };
  expect(status.signedIn).toBe(true);

  await page.evaluate(() => (location.hash = '#/friends'));
  await expect(page.getByText('signed in as SocialTester')).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => (location.hash = '#/wardrobe'));
  await page.getByRole('tab', { name: 'Lifea Cosmetics' }).click();
  await page.getByRole('button', { name: /Ember Cape/ }).click();
  await expect(page.getByRole('button', { name: /Ember Cape/ })).toContainText('Equipped');
  await app.close();
});
