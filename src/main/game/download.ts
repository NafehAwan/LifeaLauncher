/**
 * Download engine used by everything (assets, libraries, runtimes, mods).
 * Streams to `<dest>.part` with an in-stream SHA-1, verifies size + hash, then renames.
 * Shared concurrency pool, retries with backoff, AbortSignal everywhere, throttled aggregate progress.
 */
import { createHash } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import pLimit from 'p-limit';
import { abortError, HttpError, isAbort, request, sleep } from '../core/http';

export interface DownloadTask {
  url: string;
  path: string;
  sha1?: string;
  size?: number;
  name?: string;
}

export interface Progress {
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  speedBps: number;
  etaSec: number;
  current?: string;
}

let limit = pLimit(24);
export function setConcurrency(n: number): void {
  limit = pLimit(Math.max(1, Math.min(64, Math.round(n))));
}

const BACKOFF = [500, 1500, 4000];

async function sha1File(path: string): Promise<string> {
  const hash = createHash('sha1');
  const fh = await fs.open(path, 'r');
  try {
    for await (const chunk of fh.createReadStream()) hash.update(chunk as Buffer);
  } finally {
    await fh.close().catch(() => undefined);
  }
  return hash.digest('hex');
}

/** True when the file already exists and matches size (and hash, if `verify`). */
export async function isUpToDate(task: DownloadTask, verify = false): Promise<boolean> {
  const st = await fs.stat(task.path).catch(() => null);
  if (!st || !st.isFile()) return false;
  if (task.size !== undefined && st.size !== task.size) return false;
  if (task.size === undefined && st.size === 0) return false;
  if ((verify || task.size === undefined) && task.sha1) return (await sha1File(task.path)) === task.sha1.toLowerCase();
  return true;
}

export async function downloadFile(task: DownloadTask, signal?: AbortSignal, onBytes?: (n: number) => void): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    if (signal?.aborted) throw abortError();
    const part = `${task.path}.part`;
    let counted = 0;
    try {
      await fs.mkdir(dirname(task.path), { recursive: true });
      const res = await request(task.url, { signal });
      if (!res.body) throw new Error(`Empty body for ${task.url}`);
      const hash = createHash('sha1');
      let size = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          hash.update(chunk);
          size += chunk.length;
          counted += chunk.length;
          onBytes?.(chunk.length);
          cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), meter, createWriteStream(part), { signal });
      if (task.size !== undefined && size !== task.size) throw new Error(`Size mismatch for ${task.name ?? task.url} (${size} ≠ ${task.size})`);
      const digest = hash.digest('hex');
      if (task.sha1 && digest !== task.sha1.toLowerCase()) throw new Error(`SHA-1 mismatch for ${task.name ?? task.url}`);
      await fs.rename(part, task.path);
      return;
    } catch (e) {
      await fs.unlink(part).catch(() => undefined);
      if (counted) onBytes?.(-counted);
      if (isAbort(e) || signal?.aborted) throw abortError();
      lastErr = e;
      // 404/403 will not fix themselves.
      if (e instanceof HttpError && (e.status === 404 || e.status === 403 || e.status === 410)) break;
      if (attempt < BACKOFF.length) await sleep(e instanceof HttpError && e.retryAfterMs ? e.retryAfterMs : BACKOFF[attempt], signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Download many files through the shared pool. Skips files that are already present (size check).
 * `onProgress` is throttled to one call per 100 ms (plus a final call).
 */
export async function downloadAll(
  tasks: DownloadTask[],
  opts: { signal?: AbortSignal; onProgress?: (p: Progress) => void; verify?: boolean } = {},
): Promise<{ downloaded: number; skipped: number }> {
  const unique = [...new Map(tasks.map((t) => [t.path, t])).values()];
  const progress: Progress = { filesDone: 0, filesTotal: unique.length, bytesDone: 0, bytesTotal: 0, speedBps: 0, etaSec: 0 };
  const samples: { t: number; b: number }[] = [];
  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 100) return;
    lastEmit = now;
    samples.push({ t: now, b: progress.bytesDone });
    while (samples.length > 1 && now - samples[0].t > 3000) samples.shift();
    const first = samples[0];
    const dt = (now - first.t) / 1000;
    progress.speedBps = dt > 0.2 ? Math.max(0, (progress.bytesDone - first.b) / dt) : progress.speedBps;
    const remaining = Math.max(0, progress.bytesTotal - progress.bytesDone);
    progress.etaSec = progress.speedBps > 0 ? Math.round(remaining / progress.speedBps) : 0;
    opts.onProgress?.({ ...progress });
  };

  // Pass 1: find what is missing (cheap stat calls, also pooled).
  const missing: DownloadTask[] = [];
  await Promise.all(
    unique.map((t) =>
      limit(async () => {
        if (opts.signal?.aborted) throw abortError();
        if (await isUpToDate(t, opts.verify)) {
          progress.filesDone++;
        } else {
          missing.push(t);
          progress.bytesTotal += t.size ?? 0;
        }
      }),
    ),
  );
  emit(true);

  // Pass 2: download.
  let failure: unknown;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await Promise.all(
      missing.map((t) =>
        limit(async () => {
          if (controller.signal.aborted) return;
          progress.current = t.name ?? t.path;
          try {
            await downloadFile(t, controller.signal, (n) => {
              progress.bytesDone += n;
              emit();
            });
            progress.filesDone++;
            emit();
          } catch (e) {
            if (!failure) failure = e;
            controller.abort();
          }
        }),
      ),
    );
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
  }
  if (opts.signal?.aborted) throw abortError();
  if (failure) throw failure;
  emit(true);
  return { downloaded: missing.length, skipped: unique.length - missing.length };
}
