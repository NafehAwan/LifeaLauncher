/**
 * Sandboxed preload. Exposes a tiny, whitelisted bridge: invoke(channel) for channels in the shared contract and
 * on(event) for main → renderer events. Built as CommonJS (.cjs) — Electron cannot load an ESM preload from .js (P0-3).
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { EVENT_CHANNELS, INVOKE_CHANNELS, type LifeaBridge } from '@shared/ipc';

const invokeAllowed = new Set<string>(INVOKE_CHANNELS);
const eventAllowed = new Set<string>(EVENT_CHANNELS);

const bridge: LifeaBridge = {
  invoke(channel, ...args) {
    if (!invokeAllowed.has(channel)) return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, cb) {
    if (!eventAllowed.has(channel)) throw new Error(`Blocked IPC event: ${channel}`);
    const listener = (_e: Electron.IpcRendererEvent, payload: unknown) => cb(payload as never);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  pathForFile(file) {
    return webUtils.getPathForFile(file);
  },
};

contextBridge.exposeInMainWorld('lifea', bridge);
