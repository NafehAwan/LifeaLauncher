/** Visual review helper: LIFEA_SCREENS=<dir> npx playwright test screens — captures every page. Skipped otherwise. */
import { test } from '@playwright/test';
import { launch } from './app';

const PAGES: [string, string][] = [
  ['home', '#/'], ['library', '#/library'], ['browse', '#/browse'], ['boost', '#/boost'], ['wardrobe', '#/wardrobe'],
  ['friends', '#/friends'], ['servers', '#/servers'], ['console', '#/console'], ['settings', '#/settings?tab=appearance'], ['profile', '#/instance/lifea-latest'],
];

test('screens', async () => {
  const dir = process.env.LIFEA_SCREENS;
  test.skip(!dir, 'set LIFEA_SCREENS to capture');
  const { app, page } = await launch();
  await page.setViewportSize({ width: 1280, height: 780 });
  await page.waitForSelector('[data-testid="app-shell"]');
  await page.waitForTimeout(1200);
  for (const [name, hash] of PAGES) {
    await page.evaluate((h) => (location.hash = h), hash);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${dir}/${name}.png` });
  }
  await page.keyboard.press('Control+K');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/palette.png` });
  await app.close();
});
