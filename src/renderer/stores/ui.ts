import { create } from 'zustand';

interface UiStore {
  palette: boolean;
  newProfile: boolean;
  addAccount: boolean;
  set: (p: Partial<Omit<UiStore, 'set'>>) => void;
}

export const useUi = create<UiStore>((set) => ({ palette: false, newProfile: false, addAccount: false, set }));
