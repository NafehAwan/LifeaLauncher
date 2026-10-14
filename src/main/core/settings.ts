/**
 * Settings store: in-memory cache, zod-validated, atomic debounced writes that MERGE patches.
 * Lives at userData/settings.json — never derived from settings itself (fixes P0-1).
 */
import { promises as fs } from 'node:fs';
import { migrateSettings, settingsPatchSchema } from '@shared/schemas';
import type { Settings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { settingsFile } from './paths';
import { writeJsonAtomic } from './fsx';
import { log } from './log';

let cache: Settings = { ...DEFAULT_SETTINGS };
let loaded = false;
let writeTimer: NodeJS.Timeout | null = null;
let writing: Promise<void> = Promise.resolve();
const listeners = new Set<(s: Settings) => void>();

export interface LoadResult {
  settings: Settings;
  recovered?: string;
}

export async function loadSettings(): Promise<LoadResult> {
  const file = settingsFile();
  let raw: unknown = undefined;
  let recovered: string | undefined;
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      recovered = `${file.replace(/\.json$/, '')}.corrupt-${Date.now()}.json`;
      await fs.rename(file, recovered).catch(() => undefined);
      log.warn('settings.json was unreadable; backed up to', recovered);
    }
  }
  // agent-5 kept its settings in electron-store format: { settings: {...} }
  if (raw && typeof raw === 'object' && 'settings' in (raw as object) && !('schemaVersion' in (raw as object))) {
    raw = (raw as { settings: unknown }).settings;
  }
  const { settings, changed } = migrateSettings(raw);
  cache = settings;
  loaded = true;
  if (changed || recovered) await writeJsonAtomic(file, cache);
  return { settings: cache, recovered };
}

export function getSettings(): Settings {
  return cache;
}

export function isLoaded(): boolean {
  return loaded;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const parsed = settingsPatchSchema.parse(patch);
  cache = { ...cache, ...parsed, schemaVersion: 2 };
  scheduleWrite();
  for (const l of listeners) l(cache);
  return cache;
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushSettings();
  }, 300);
}

export function flushSettings(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const snapshot = cache;
  writing = writing.then(() => writeJsonAtomic(settingsFile(), snapshot)).catch((e) => log.error('settings write failed', e));
  return writing;
}
