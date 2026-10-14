/**
 * Console ring buffer. A fixed-size circular buffer means appending a line never copies the whole array; a version
 * counter tells React when to re-read (fixes the O(n) copy-per-line in the old consoleStore).
 */
import { create } from 'zustand';
import type { LogLine } from '@shared/types';
import { call, on } from '../lib/ipc';

export class Ring<T> {
  private buf: (T | undefined)[];
  private start = 0;
  size = 0;
  constructor(private cap: number) {
    this.buf = new Array(cap);
  }
  push(item: T): void {
    if (this.size < this.cap) {
      this.buf[(this.start + this.size) % this.cap] = item;
      this.size++;
    } else {
      this.buf[this.start] = item;
      this.start = (this.start + 1) % this.cap;
    }
  }
  at(i: number): T {
    return this.buf[(this.start + i) % this.cap] as T;
  }
  toArray(): T[] {
    const out = new Array<T>(this.size);
    for (let i = 0; i < this.size; i++) out[i] = this.at(i);
    return out;
  }
  clear(): void {
    this.start = 0;
    this.size = 0;
  }
  resize(cap: number): void {
    const items = this.toArray().slice(-cap);
    this.cap = cap;
    this.buf = new Array(cap);
    this.start = 0;
    this.size = 0;
    for (const i of items) this.push(i);
  }
}

interface LogStore {
  ring: Ring<LogLine>;
  version: number;
  init: (max: number) => Promise<void>;
  clear: () => void;
  setMax: (n: number) => void;
}

let scheduled = false;

export const useLogs = create<LogStore>((set, get) => ({
  ring: new Ring<LogLine>(20000),
  version: 0,
  init: async (max) => {
    const ring = new Ring<LogLine>(max);
    for (const l of await call('launch:logs')) ring.push(l);
    set({ ring, version: get().version + 1 });
    on('launch:logs', (batch) => {
      const r = get().ring;
      for (const l of batch) r.push(l);
      // Coalesce bursts into one render per frame.
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          set({ version: get().version + 1 });
        });
      }
    });
  },
  clear: () => {
    get().ring.clear();
    set({ version: get().version + 1 });
  },
  setMax: (n) => {
    get().ring.resize(n);
    set({ version: get().version + 1 });
  },
}));
