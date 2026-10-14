import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '@shared/constants';
import type { Settings } from '@shared/types';
import { call, on } from '../lib/ipc';
import { hexToRgba, shade } from '../lib/util';

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  init: () => Promise<void>;
  patch: (p: Partial<Settings>) => Promise<void>;
}

export function applyAppearance(s: Settings): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--accent-hi', shade(s.accent, 0.18));
  root.style.setProperty('--accent-lo', shade(s.accent, -0.35));
  root.style.setProperty('--accent-glow', hexToRgba(s.accent, 0.4));
  root.style.setProperty('--accent-soft', hexToRgba(s.accent, 0.12));
  const reduce = s.reducedMotion === 'on' || (s.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.toggle('reduce-motion', reduce);
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  init: async () => {
    const s = await call('settings:get');
    set({ settings: s, loaded: true });
    applyAppearance(s);
    on('settings:changed', (next) => {
      set({ settings: next });
      applyAppearance(next);
    });
  },
  patch: async (p) => {
    const optimistic = { ...get().settings, ...p };
    set({ settings: optimistic });
    applyAppearance(optimistic);
    const saved = await call('settings:set', p);
    set({ settings: saved });
  },
}));

export function prefersReducedMotion(s: Settings): boolean {
  return s.reducedMotion === 'on' || (s.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
