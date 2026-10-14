/** Tests that touch the filesystem, with a stubbed fetch (no network). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fabricProfile from './fixtures/fabric-profile-1.21.4.json';
import v1214 from './fixtures/version-1.21.4.json';
import { setFetch } from '../src/main/core/http';
import { allGameDirs, initPaths, settingsFile, versionsDir } from '../src/main/core/paths';
import { flushSettings, getSettings, loadSettings, updateSettings } from '../src/main/core/settings';
import { downloadAll, downloadFile } from '../src/main/game/download';
import { installLoaderProfile } from '../src/main/game/loaders/fabric';
import { resolveVersion } from '../src/main/game/versions';

let root: string;
const sha1 = (b: Buffer | string) => createHash('sha1').update(b).digest('hex');

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'lifea-test-'));
  initPaths({ userData: join(root, 'userData'), home: root, gameDirSetting: () => getSettings().gameDir });
  await fs.mkdir(join(root, 'userData'), { recursive: true });
});
afterEach(async () => {
  setFetch((...a) => globalThis.fetch(...a));
  await fs.rm(root, { recursive: true, force: true });
});

describe('settings store (P0-1 regression)', () => {
  it('loads with no file and resolves game dirs without recursion', async () => {
    const { settings } = await loadSettings();
    expect(settings.schemaVersion).toBe(2);
    const dirs = allGameDirs();
    expect(dirs[0]).toBe(join(root, '.lifea'));
  });
  it('migrates the agent-5 electron-store file shape', async () => {
    await fs.writeFile(settingsFile(), JSON.stringify({ settings: { schemaVersion: 1, theme: 'ember-night', dataDir: '' } }));
    const { settings } = await loadSettings();
    expect(settings.theme).toBe('ember_night');
  });
  it('backs up a corrupt file instead of crashing', async () => {
    await fs.writeFile(settingsFile(), '{not json');
    const r = await loadSettings();
    expect(r.recovered).toBeTruthy();
    expect(existsSync(r.recovered!)).toBe(true);
  });
  it('merges patches and writes atomically', async () => {
    await loadSettings();
    updateSettings({ theme: 'ash_oasis' });
    updateSettings({ zoom: 1.1 });
    await flushSettings();
    const disk = JSON.parse(await fs.readFile(settingsFile(), 'utf8'));
    expect(disk.theme).toBe('ash_oasis');
    expect(disk.zoom).toBe(1.1);
  });
  it('rejects invalid patches', async () => {
    await loadSettings();
    expect(() => updateSettings({ zoom: 99 })).toThrow();
  });
});

describe('download engine', () => {
  it('verifies SHA-1, retries a corrupt response, then succeeds', async () => {
    const good = Buffer.from('hello lifea');
    let calls = 0;
    setFetch(async () => {
      calls++;
      return new Response(calls === 1 ? 'corrupted!!' : good);
    });
    const dest = join(root, 'a', 'file.bin');
    await downloadFile({ url: 'https://x/file', path: dest, sha1: sha1(good), size: good.length });
    expect(await fs.readFile(dest, 'utf8')).toBe('hello lifea');
    expect(calls).toBe(2);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });
  it('does not retry 404s', async () => {
    let calls = 0;
    setFetch(async () => {
      calls++;
      return new Response('nope', { status: 404 });
    });
    await expect(downloadFile({ url: 'https://x/missing', path: join(root, 'm') })).rejects.toThrow(/404/);
    expect(calls).toBe(1);
  });
  it('skips files that are already present and reports progress', async () => {
    const data = Buffer.from('x'.repeat(1000));
    await fs.mkdir(join(root, 'd'), { recursive: true });
    await fs.writeFile(join(root, 'd', '0'), data);
    let fetched = 0;
    setFetch(async () => {
      fetched++;
      return new Response(data);
    });
    const tasks = Array.from({ length: 5 }, (_, i) => ({ url: `https://x/${i}`, path: join(root, 'd', String(i)), sha1: sha1(data), size: data.length }));
    const progress: number[] = [];
    const r = await downloadAll(tasks, { onProgress: (p) => progress.push(p.filesDone) });
    expect(r).toEqual({ downloaded: 4, skipped: 1 });
    expect(fetched).toBe(4);
    expect(progress.at(-1)).toBe(5);
  });
  it('cancels', async () => {
    setFetch(async (_u, init) => new Promise((_res, rej) => (init?.signal as AbortSignal).addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const ac = new AbortController();
    const p = downloadAll([{ url: 'https://x/slow', path: join(root, 'slow') }], { signal: ac.signal });
    setTimeout(() => ac.abort(), 20);
    await expect(p).rejects.toThrow(/Cancelled/);
  });
});

describe('Fabric install via profile/json (P0-10)', () => {
  it('saves the profile and resolves it onto vanilla', async () => {
    await loadSettings();
    await fs.mkdir(join(versionsDir(), '1.21.4'), { recursive: true });
    await fs.writeFile(join(versionsDir(), '1.21.4', '1.21.4.json'), JSON.stringify(v1214));
    const urls: string[] = [];
    setFetch(async (u) => {
      urls.push(String(u));
      if (String(u).endsWith('/profile/json')) return Response.json(fabricProfile);
      return Response.json([{ loader: { version: '0.16.10', stable: false } }, { loader: { version: '0.16.9', stable: true } }]);
    });
    const r = await installLoaderProfile('fabric', '1.21.4');
    expect(r).toEqual({ id: 'fabric-loader-0.16.9-1.21.4', loader: '0.16.9' });
    expect(urls[1]).toBe('https://meta.fabricmc.net/v2/versions/loader/1.21.4/0.16.9/profile/json');
    const resolved = await resolveVersion(r.id);
    expect(resolved.mainClass).toContain('KnotClient');
    expect(resolved.downloads?.client).toBeDefined();
  });
});
