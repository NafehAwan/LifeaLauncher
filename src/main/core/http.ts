/**
 * HTTP helpers. In the app, `setFetch(net.fetch)` is called at startup so requests honour the system proxy;
 * tests use the global fetch or a stub.
 */
let fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args);
let userAgent = 'LifeaLauncher (+https://github.com/nafehawan/lifealauncher)';

export function setFetch(impl: typeof fetch): void {
  fetchImpl = impl;
}
export function setUserAgent(ua: string): void {
  userAgent = ua;
}
export function getUserAgent(): string {
  return userAgent;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body = '',
    readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status} for ${url}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
}

export async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', userAgent);
  const res = await fetchImpl(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const ra = res.headers.get('retry-after');
    throw new HttpError(res.status, url, body, ra ? Number(ra) * 1000 : undefined);
  }
  return res;
}

export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await request(url, { ...init, headers: { Accept: 'application/json', ...(init.headers as Record<string, string>) } });
  return (await res.json()) as T;
}

export async function postJson<T>(url: string, body: unknown, init: RequestInit = {}): Promise<T> {
  const res = await request(url, {
    ...init,
    method: init.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers as Record<string, string>) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(abortError());
    }, { once: true });
  });
}

export function abortError(): Error {
  const e = new Error('Cancelled');
  e.name = 'AbortError';
  return e;
}

export function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}
