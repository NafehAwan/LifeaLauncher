/** Launch states per profile. Kept separate from everything else so only launch UI re-renders on progress. */
import { create } from 'zustand';
import type { LaunchState } from '@shared/types';
import { call, on } from '../lib/ipc';

const ACTIVE = new Set(['preparing', 'downloading', 'installing', 'launching', 'running']);

interface LaunchStore {
  states: Record<string, LaunchState>;
  init: () => Promise<void>;
}

export const useLaunch = create<LaunchStore>((set) => ({
  states: {},
  init: async () => {
    const list = await call('launch:states');
    set({ states: Object.fromEntries(list.map((s) => [s.instanceId, s])) });
    on('launch:state', (s) => set((prev) => ({ states: { ...prev.states, [s.instanceId]: s } })));
  },
}));

export const isActive = (s?: LaunchState) => !!s && ACTIVE.has(s.status);
export const isBusy = (s?: LaunchState) => !!s && ACTIVE.has(s.status) && s.status !== 'running';
export const anyRunning = (states: Record<string, LaunchState>) => Object.values(states).some((s) => s.status === 'running');
export const anyActive = (states: Record<string, LaunchState>) => Object.values(states).some(isActive);
