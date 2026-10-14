/**
 * Streaming zip helpers on top of yauzl. Inflation runs in libuv's threadpool, so large archives never block the
 * main thread. Every write goes through a path-traversal guard.
 */
import { createWriteStream, promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { safeJoin } from './fsx';

function open(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) =>
    yauzl.open(path, { lazyEntries: true, autoClose: true, strictFileNames: false, validateEntrySizes: true }, (err, zip) =>
      err || !zip ? reject(err ?? new Error('Cannot open zip')) : resolve(zip),
    ),
  );
}

function openStream(zip: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (err, s) => (err || !s ? reject(err ?? new Error('stream')) : resolve(s))));
}

/** Iterate entries; the callback decides what to do and may read the entry via the provided opener. */
export async function walkZip(
  path: string,
  fn: (entry: Entry, read: () => Promise<Readable>) => Promise<void> | void,
): Promise<void> {
  const zip = await open(path);
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject);
    zip.on('end', () => resolve());
    zip.on('entry', (entry: Entry) => {
      Promise.resolve(fn(entry, () => openStream(zip, entry)))
        .then(() => zip.readEntry())
        .catch((e) => {
          zip.close();
          reject(e);
        });
    });
    zip.readEntry();
  });
}

async function streamToBuffer(s: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/** Read a single small entry (e.g. modrinth.index.json) into memory. */
export async function readZipEntry(path: string, name: string): Promise<Buffer | null> {
  let found: Buffer | null = null;
  await walkZip(path, async (entry, read) => {
    if (!found && entry.fileName === name) found = await streamToBuffer(await read());
  });
  return found;
}

/** Extract entries accepted by `map` (which returns the relative output path, or null to skip). */
export async function extractZip(path: string, destDir: string, map: (name: string) => string | null): Promise<number> {
  let count = 0;
  await walkZip(path, async (entry, read) => {
    if (entry.fileName.endsWith('/')) return;
    const rel = map(entry.fileName);
    if (!rel) return;
    const out = safeJoin(destDir, ...rel.split('/'));
    await fs.mkdir(dirname(out), { recursive: true });
    await pipeline(await read(), createWriteStream(out));
    count++;
  });
  return count;
}
