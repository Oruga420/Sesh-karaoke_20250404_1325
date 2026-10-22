/* eslint-env serviceworker */
// eslint-disable-next-line no-restricted-globals -- self is the native ServiceWorkerGlobalScope in this standalone worker.
const workerScope = self;
const CACHE_PREFIX = 'oruga-karaoke-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const MAX_ENTRIES = 64;

function staticAsset(url) {
  return url.origin === workerScope.location.origin && !url.search && !url.hash &&
    /^\/static\/(js|css|media)\/[a-zA-Z0-9_.-]+\.[a-f0-9]{8,}\.(?:chunk\.)?(js|css|woff2?|ttf|svg|png|jpe?g|webp|ico)$/.test(url.pathname);
}
function cacheable(response) { return response.ok && !response.redirected && response.type !== 'opaque'; }
async function trim(cache) {
  const keys = await cache.keys();
  const removable = keys.filter(key => new URL(key.url).pathname !== '/');
  for (const key of removable.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(key);
}
async function store(cache, key, response) {
  if (cacheable(response)) { await cache.put(key, response.clone()); await trim(cache); }
}

workerScope.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // These public build files are fetched without cookies or authorization.
    const shell = await fetch('/', { cache: 'reload', credentials: 'omit', redirect: 'error' });
    if (!cacheable(shell) || !(shell.headers.get('Content-Type') || '').includes('text/html')) throw new Error('App shell unavailable');
    const manifest = await fetch('/asset-manifest.json', { cache: 'no-store', credentials: 'omit', redirect: 'error' });
    if (!cacheable(manifest)) throw new Error('App manifest unavailable');
    const data = await manifest.json();
    const assets = Object.values(data.files || {}).filter(value => typeof value === 'string')
      .map(value => new URL(value, workerScope.location.origin)).filter(staticAsset).slice(0, MAX_ENTRIES - 1);
    if (!assets.some(url => url.pathname.endsWith('.js'))) throw new Error('App build assets unavailable');
    await Promise.all(assets.map(async url => {
      const response = await fetch(url.href, { cache: 'reload', credentials: 'omit', redirect: 'error' });
      if (!cacheable(response)) throw new Error('App build asset unavailable');
      await cache.put(url.href, response);
    }));
    await store(cache, '/', shell);
    await workerScope.skipWaiting();
  })());
});

workerScope.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await workerScope.clients.claim();
  })());
});

workerScope.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== workerScope.location.origin || url.search || url.hash || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { credentials: 'omit', redirect: 'error' });
        if ((response.headers.get('Content-Type') || '').includes('text/html')) await store(cache, '/', response);
        return response;
      } catch (error) {
        const saved = await cache.match('/');
        if (saved) return saved;
        throw error;
      }
    })());
  } else if (staticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request, { credentials: 'omit', redirect: 'error' });
      await store(cache, request, response);
      return response;
    })());
  }
});
