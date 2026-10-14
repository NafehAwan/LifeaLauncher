/** Typed access to the preload bridge. Errors are cleaned of Electron's "Error invoking remote method" prefix. */
import type { EventChannel, InvokeArgs, InvokeChannel, InvokeResult, IpcEvents, LifeaBridge } from '@shared/ipc';

declare global {
  interface Window {
    lifea?: LifeaBridge;
  }
}

export const hasBridge = () => typeof window !== 'undefined' && !!window.lifea;

export function cleanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '');
}

export async function call<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>> {
  if (!window.lifea) throw new Error('The launcher bridge is not available.');
  try {
    return await window.lifea.invoke(channel, ...args);
  } catch (e) {
    throw new Error(cleanError(e));
  }
}

export function on<E extends EventChannel>(channel: E, cb: (payload: IpcEvents[E]) => void): () => void {
  return window.lifea ? window.lifea.on(channel, cb) : () => undefined;
}

export function pathForFile(file: File): string {
  return window.lifea?.pathForFile(file) ?? '';
}
