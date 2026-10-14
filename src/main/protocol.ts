/**
 * `app://` protocol (fixes P0-4, P0-5 and the never-registered `lifea://`):
 *   app://lifea/…                       → the built renderer (dist/), SPA fallback to index.html
 *   app://wardrobe/<skins|capes>/<f>    → the user's skin/cape library
 *   app://instances/<id>/screenshots/<f> → screenshots
 * Every path is resolved inside its root; anything else is 403.
 */
import { app, net, protocol } from 'electron';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { instancesDir, wardrobeDir } from './core/paths';

export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
  ]);
}

function inside(root: string, rel: string): string | null {
  const base = resolve(root);
  const file = normalize(join(base, rel));
  return file === base || file.startsWith(base + sep) ? file : null;
}

export function handleAppProtocol(): void {
  const distRoot = join(app.getAppPath(), 'dist');
  protocol.handle('app', async (req) => {
    const url = new URL(req.url);
    const rel = decodeURIComponent(url.pathname);
    let file: string | null = null;
    if (url.host === 'lifea') {
      file = inside(distRoot, rel === '/' ? 'index.html' : rel);
      if (file && !existsSync(file) && !extname(file)) file = join(distRoot, 'index.html');
    } else if (url.host === 'wardrobe') {
      file = /^\/(skins|capes)\/[^/]+\.png$/i.test(rel) ? inside(wardrobeDir(), rel) : null;
    } else if (url.host === 'instances') {
      file = /^\/[\w.-]+\/screenshots\/[^/]+\.png$/i.test(rel) ? inside(instancesDir(), rel) : null;
    }
    if (!file) return new Response('Forbidden', { status: 403 });
    if (!existsSync(file)) return new Response('Not found', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    if (url.host !== 'lifea') headers.set('Cache-Control', 'no-cache');
    return new Response(res.body, { status: res.status, headers });
  });
}
