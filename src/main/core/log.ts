/** Tiny rotating file logger for the main process (userData/logs/main.log, 5 × 1 MB). */
import { appendFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_BYTES = 1024 * 1024;
const KEEP = 5;
let file = '';
let queue: Promise<void> = Promise.resolve();

export function initLog(dir: string): void {
  file = join(dir, 'main.log');
  queue = queue.then(() => mkdir(dir, { recursive: true }).then(() => undefined)).catch(() => undefined);
}

export function logFilePath(): string {
  return file;
}

async function rotate(): Promise<void> {
  const s = await stat(file).catch(() => null);
  if (!s || s.size < MAX_BYTES) return;
  await unlink(`${file}.${KEEP}`).catch(() => undefined);
  for (let i = KEEP - 1; i >= 1; i--) await rename(`${file}.${i}`, `${file}.${i + 1}`).catch(() => undefined);
  await rename(file, `${file}.1`).catch(() => undefined);
}

function write(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ''}` : typeof a === 'string' ? a : safeStringify(a)))
    .join(' ')}\n`;
  if (level === 'ERROR') process.stderr.write(line);
  else if (process.env.NODE_ENV === 'development') process.stdout.write(line);
  if (!file) return;
  queue = queue.then(rotate).then(() => appendFile(file, line)).catch(() => undefined);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export const log = {
  info: (...a: unknown[]) => write('INFO', a),
  warn: (...a: unknown[]) => write('WARN', a),
  error: (...a: unknown[]) => write('ERROR', a),
  debug: (...a: unknown[]) => write('DEBUG', a),
};
