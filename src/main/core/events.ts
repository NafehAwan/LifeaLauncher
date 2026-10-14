/** Typed broadcast from main to every renderer window. */
import type { EventChannel, IpcEvents } from '@shared/ipc';

type Sender = (channel: string, payload: unknown) => void;
let sender: Sender = () => undefined;

export function setSender(fn: Sender): void {
  sender = fn;
}

export function emit<E extends EventChannel>(channel: E, payload: IpcEvents[E]): void {
  sender(channel, payload);
}

export function notice(level: 'info' | 'warn' | 'error', message: string, detail?: string): void {
  emit('app:notice', { level, message, detail });
}
