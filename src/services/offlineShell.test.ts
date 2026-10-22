import { readFileSync } from 'fs';
import path from 'path';
import vm from 'vm';
import { registerOfflineShell } from './offlineShell';

const origin = 'https://karaoke.fixture';
interface FakeResponse { ok: boolean; redirected: boolean; type: string; body: string; headers: { get: (name: string) => string }; clone: () => FakeResponse; json: () => Promise<unknown> }
function response(body = 'Synthetic shell', contentType = 'text/html'): FakeResponse {
  return { ok: true, redirected: false, type: 'basic', body, headers: { get: () => contentType },
    clone: () => response(body, contentType), json: async () => JSON.parse(body) };
}
function worker() {
  const listeners: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, FakeResponse>>();
  const address = (key: string | { url: string }) => new URL(typeof key === 'string' ? key : key.url, origin).href;
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name)!;
    return { put: async (key: string, value: FakeResponse) => { entries.set(address(key), value); },
      match: async (key: string) => entries.get(address(key)), keys: async () => Array.from(entries.keys()).map(url => ({ url })),
      delete: async (key: string) => entries.delete(address(key)) };
  };
  const fetchMock = jest.fn(async (key: string | { url: string }) => {
    const url = address(key);
    return url.endsWith('asset-manifest.json') ? response(JSON.stringify({ files: {
      main: '/static/js/main.1234abcd.js', css: '/static/css/main.abcdef12.css',
      forbiddenApi: '/api/lyrics?title=Synthetic', forbiddenAuth: 'https://accounts.spotify.com/authorize',
    } }), 'application/json') : response();
  });
  const claim = jest.fn();
  vm.runInNewContext(readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8'), {
    URL, fetch: fetchMock, caches: { open: async (name: string) => cacheFor(name), keys: async () => Array.from(stores.keys()), delete: async (name: string) => stores.delete(name) },
    self: { location: new URL(origin), addEventListener: (name: string, listener: (event: any) => void) => { listeners[name] = listener; },
      skipWaiting: async () => undefined, clients: { claim } },
  });
  const lifecycle = async (name: string) => {
    let pending: Promise<void> | undefined;
    listeners[name]({ waitUntil: (value: Promise<void>) => { pending = value; } });
    await pending;
  };
  const intercept = (url: string, method = 'GET', mode = 'navigate', authorization = false) => {
    let pending: Promise<FakeResponse> | undefined;
    listeners.fetch({ request: { url: new URL(url, origin).href, method, mode, headers: { has: () => authorization } },
      respondWith: (value: Promise<FakeResponse>) => { pending = value; } });
    return pending;
  };
  return { stores, fetchMock, claim, lifecycle, intercept };
}

it('preloads only public same-origin build assets and restores an actual cached document offline', async () => {
  const sw = worker(); await sw.lifecycle('install');
  expect(sw.fetchMock).toHaveBeenCalledTimes(4);
  expect(sw.fetchMock.mock.calls.every(call => !String(call[0]).includes('spotify.com') && !String(call[0]).includes('/api/lyrics'))).toBe(true);
  sw.fetchMock.mockRejectedValue(new TypeError('Synthetic offline'));
  expect((await sw.intercept('/'))?.body).toBe('Synthetic shell');
  const beforeStatic = sw.fetchMock.mock.calls.length;
  expect((await sw.intercept('/static/js/main.1234abcd.js', 'GET', 'cors'))?.body).toBe('Synthetic shell');
  expect(sw.fetchMock).toHaveBeenCalledTimes(beforeStatic);
});

it('uses the network first for clean online root navigation', async () => {
  const sw = worker(); await sw.lifecycle('install');
  sw.fetchMock.mockResolvedValue(response('New synthetic shell'));
  expect((await sw.intercept('/'))?.body).toBe('New synthetic shell');
  sw.fetchMock.mockRejectedValue(new Error('Offline'));
  expect((await sw.intercept('/'))?.body).toBe('New synthetic shell');
});

it('never intercepts API, callback, auth/query navigations, private headers, writes, or foreign URLs', async () => {
  const sw = worker(); await sw.lifecycle('install');
  for (const url of ['/api/lyrics', '/callback', '/callback?code=fixture', '/?code=fixture&state=fixture', '/?spotify_login=1',
    '/static/js/main.1234abcd.js?auth=fixture', 'https://accounts.spotify.com/authorize', 'https://unrelated.invalid/static/js/main.1234abcd.js']) {
    expect(sw.intercept(url)).toBeUndefined();
  }
  expect(sw.intercept('/', 'POST')).toBeUndefined();
  expect(sw.intercept('/', 'GET', 'navigate', true)).toBeUndefined();
});

it('bounds cached assets and removes only older caches in its own namespace', async () => {
  const sw = worker(); await sw.lifecycle('install');
  const name = Array.from(sw.stores.keys())[0];
  const entries = sw.stores.get(name)!;
  for (let index = 0; index < 80; index += 1) entries.set(`${origin}/static/js/${index}.abcdef12.js`, response());
  await sw.intercept('/static/js/new.abcdef99.js', 'GET', 'cors');
  expect(entries.size).toBeLessThanOrEqual(64);
  expect(entries.has(origin + '/')).toBe(true);
  sw.stores.set('oruga-karaoke-shell-old', new Map()); sw.stores.set('unrelated-app-cache', new Map());
  await sw.lifecycle('activate');
  expect(sw.stores.has('oruga-karaoke-shell-old')).toBe(false);
  expect(sw.stores.has('unrelated-app-cache')).toBe(true);
  expect(sw.claim).toHaveBeenCalledTimes(1);
});

it('registers the optional worker only in production and supported origins', async () => {
  const initialEnv = process.env.NODE_ENV;
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const register = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
  process.env.NODE_ENV = 'test'; registerOfflineShell(); expect(register).not.toHaveBeenCalled();
  process.env.NODE_ENV = 'production'; registerOfflineShell(); expect(register).toHaveBeenCalledWith('/sw.js');
  register.mockRejectedValue(new Error('Disabled worker')); registerOfflineShell(); await Promise.resolve();
  process.env.NODE_ENV = initialEnv;
  if (descriptor) Object.defineProperty(navigator, 'serviceWorker', descriptor);
  else delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
});
