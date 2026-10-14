import { z } from 'zod';
import { DEFAULT_SETTINGS, LEGACY_THEME_IDS, THEME_IDS } from './constants';
import type { Settings } from './types';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const settingsSchema = z.object({
  schemaVersion: z.literal(2),
  theme: z.enum(THEME_IDS),
  accent: hexColor,
  animatedBackground: z.boolean(),
  particles: z.boolean(),
  reducedMotion: z.enum(['system', 'on', 'off']),
  zoom: z.number().min(0.75).max(1.5),
  launchBehavior: z.enum(['hide', 'minimize', 'keep']),
  closeToTray: z.boolean(),
  gameDir: z.string(),
  defaultMemoryMb: z.number().int().min(512).max(65536),
  defaultJvmArgs: z.string().max(4000),
  gcPreset: z.enum(['g1', 'zgc']),
  javaOverrides: z.record(z.string(), z.string()),
  parallelDownloads: z.number().int().min(1).max(64),
  maxLogLines: z.number().int().min(500).max(100000),
  selectedInstanceId: z.string().optional(),
  selectedAccountId: z.string().optional(),
  backendUrl: z.string().max(500),
  friendsDrawerOpen: z.boolean(),
  autoUpdate: z.boolean(),
  onboarded: z.boolean(),
}) satisfies z.ZodType<Settings>;

export const settingsPatchSchema = settingsSchema.omit({ schemaVersion: true }).partial();

/**
 * Turn whatever is on disk (agent-5 v1 settings, a partial file, garbage) into valid v2 settings.
 * Unknown/invalid fields fall back to defaults one by one, so one bad value never wipes the rest.
 */
export function migrateSettings(raw: unknown): { settings: Settings; changed: boolean } {
  const input = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  let changed = !raw || typeof raw !== 'object' || input.schemaVersion !== 2;

  // v1 → v2 renames
  if (typeof input.theme === 'string' && LEGACY_THEME_IDS[input.theme]) {
    if (input.theme !== LEGACY_THEME_IDS[input.theme]) changed = true;
    input.theme = LEGACY_THEME_IDS[input.theme];
  }
  if (typeof input.dataDir === 'string' && input.gameDir === undefined) input.gameDir = input.dataDir;
  if (typeof input.animatedDesert === 'boolean' && input.animatedBackground === undefined) input.animatedBackground = input.animatedDesert;
  if (typeof input.maxHeap === 'number' && input.defaultMemoryMb === undefined) input.defaultMemoryMb = Math.round(input.maxHeap * 1024);
  if (typeof input.interfaceScale === 'number' && input.zoom === undefined) input.zoom = input.interfaceScale / 100;
  if (input.javaPath && typeof input.javaPath === 'string' && !input.javaOverrides) input.javaOverrides = {};

  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const shape = settingsSchema.shape as Record<string, z.ZodTypeAny>;
  for (const key of Object.keys(shape)) {
    if (key === 'schemaVersion') continue;
    if (!(key in input)) {
      if (!(key in DEFAULT_SETTINGS) || (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key] !== undefined) changed = true;
      continue;
    }
    const parsed = shape[key].safeParse(input[key]);
    if (parsed.success) out[key] = parsed.data;
    else changed = true;
  }
  out.schemaVersion = 2;
  return { settings: settingsSchema.parse(out), changed };
}
