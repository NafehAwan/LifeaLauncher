/** Shared launcher for e2e: the packaged app when LIFEA_E2E_EXECUTABLE is set, otherwise the built bundles. */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  errors: string[];
  userData: string;
}

export async function launch(userData = mkdtempSync(join(tmpdir(), 'lifea-e2e-'))): Promise<Launched> {
  const executablePath = process.env.LIFEA_E2E_EXECUTABLE;
  const args = executablePath ? [] : ['.'];
  if (process.platform === 'linux') args.push('--no-sandbox');
  const app = await electron.launch({
    executablePath,
    args,
    env: {
      ...process.env,
      LIFEA_USER_DATA: userData,
      LIFEA_DISABLE_UPDATER: '1',
      // Keep game data inside the temp profile too.
      HOME: userData,
      USERPROFILE: userData,
      NODE_ENV: 'production',
    },
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return { app, page, errors, userData };
}
