import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warn';
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), t.kind === 'error' ? 7000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (title: string, detail?: string, action?: Toast['action']) => useToasts.getState().push({ kind: 'success', title, detail, action }),
  error: (title: string, detail?: string, action?: Toast['action']) => useToasts.getState().push({ kind: 'error', title, detail, action }),
  info: (title: string, detail?: string, action?: Toast['action']) => useToasts.getState().push({ kind: 'info', title, detail, action }),
  warn: (title: string, detail?: string, action?: Toast['action']) => useToasts.getState().push({ kind: 'warn', title, detail, action }),
};

/** Run an async action and toast its failure. Returns undefined on error. */
export async function attempt<T>(fn: () => Promise<T>, failTitle: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    toast.error(failTitle, e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
