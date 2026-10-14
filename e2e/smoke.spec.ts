/**
 * Smoke test against the real Electron app. This is the test that would have caught agent-5's P0 bugs:
 * window never opening, window.lifea missing, blank page, black background.
 */
import { expect, test } from '@playwright/test';
import { launch } from './app';

const ROUTES = ['#/library', '#/browse', '#/boost', '#/wardrobe', '#/friends', '#/servers', '#/screenshots', '#/console', '#/settings'];

test('boots, exposes the bridge, renders every route, persists settings', async () => {
  const t0 = Date.now();
  const { app, page, errors, userData } = await launch();
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 15_000 });
  const bootMs = Date.now() - t0;
  console.log(`window + shell ready in ${bootMs} ms`);

  expect(page.url()).toMatch(/^app:\/\/lifea\//);
  expect(await page.evaluate(() => typeof (window as unknown as { lifea?: unknown }).lifea)).toBe('object');

  // Background canvas has loaded its WebP layers and drawn something that is not plain black.
  const canvas = page.getByTestId('background');
  await expect(canvas).toHaveAttribute('data-ready', /[1-9]/, { timeout: 10_000 });
  const drawn = await canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    return lit;
  });
  expect(drawn).toBeGreaterThan(50);

  // Built-in profiles were seeded on first run.
  await expect(page.locator('h1').first()).toContainText(/Lifea/);

  for (const r of ROUTES) {
    await page.evaluate((h) => (location.hash = h), r);
    await page.waitForSelector('h1', { timeout: 10_000 });
    await expect(page.locator('[role="alert"]:has-text("Something broke")')).toHaveCount(0);
  }

  // Theme switch changes the Home background.
  await page.evaluate(() => (location.hash = '#/settings?tab=appearance'));
  await page.locator('[data-theme-id="ember_night"]').click();
  await page.evaluate(() => (location.hash = '#/'));
  await expect(page.getByTestId('background')).toHaveAttribute('data-theme', 'ember_night');
  await expect(page.getByTestId('background')).toHaveAttribute('data-ready', /[1-9]/, { timeout: 10_000 });

  // Create an offline account through the UI.
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add account' }).click();
  await page.getByPlaceholder('Steve').fill('LifeaTester');
  await page.getByRole('button', { name: 'Add offline account' }).click();
  await expect(page.getByText('Signed in as LifeaTester')).toBeVisible();

  await page.waitForTimeout(600); // let the debounced settings write land
  await app.close();

  // Restart with the same user data: theme persisted.
  const second = await launch(userData);
  await second.page.waitForSelector('[data-testid="app-shell"]', { timeout: 15_000 });
  await expect(second.page.getByTestId('background')).toHaveAttribute('data-theme', 'ember_night');
  await second.app.close();

  const real = errors.filter((e) => !/Failed to load resource.*(mc-heads|textures\.minecraft|modrinth)/.test(e) && !/net::ERR_/.test(e));
  expect(real, real.join('\n')).toEqual([]);
});
