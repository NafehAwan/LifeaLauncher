import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Windows hosted runners need extra time for Electron's first-run profile
  // and the 3D wardrobe model to initialize before route assertions settle.
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  outputDir: 'test-results',
});
