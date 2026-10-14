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

  // Background scene: every WebP layer loaded and decoded (agent-5 showed a black screen here).
  const bg = page.getByTestId('background');
  const layers = await bg.getAttribute('data-layers');
  await expect(bg).toHaveAttribute('data-ready', layers!, { timeout: 10_000 });
  const lit = await page.evaluate(async () => {
    const el = document.querySelector('.scene-layer') as HTMLElement;
    const url = getComputedStyle(el).backgroundImage.slice(5, -2);
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(50);

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
  await expect(page.getByTestId('background')).toHaveAttribute('data-ready', '5', { timeout: 10_000 });

  // IPC arity: optional trailing arguments may be omitted (PLAY calls launch:start with just the id).
  const launchResult = await page.evaluate(async () => {
    const l = (window as unknown as { lifea: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).lifea;
    await l.invoke('launch:start', 'no-such-profile');
    await new Promise((r) => setTimeout(r, 300));
    return ((await l.invoke('launch:states')) as { instanceId: string; status: string; error?: string }[]).find((s) => s.instanceId === 'no-such-profile');
  });
  expect(launchResult).toMatchObject({ status: 'crashed', error: 'Profile not found.' });

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
