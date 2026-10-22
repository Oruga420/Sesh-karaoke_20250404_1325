export {};

let spotify: typeof import('./spotify');
let fetchMock: jest.Mock;

const originalClientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const originalRedirectUri = process.env.REACT_APP_REDIRECT_URI;

function response(status: number, data: unknown = null, retryAfter?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    headers: { get: (name: string) => name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null },
  } as unknown as Response;
}

function token(access = 'test-access', refresh?: string) {
  return { access_token: access, expires_in: 3600, refresh_token: refresh, token_type: 'Bearer', scope: '' };
}

function seedSession(expired = false) {
  localStorage.setItem('spotify_token', 'old-access');
  localStorage.setItem('spotify_refresh_token', 'test-refresh');
  localStorage.setItem('token_expiry', String(Date.now() + (expired ? -1000 : 3600000)));
}

function seedCallback(state = 'expected-state') {
  sessionStorage.setItem('spotify_pkce_verifier', 'test-verifier');
  sessionStorage.setItem('spotify_oauth_state', state);
  sessionStorage.setItem('spotify_redirect_uri', 'http://127.0.0.1:3000/callback');
  window.history.replaceState({}, '', `/callback?code=test-code&state=${state}`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  process.env.REACT_APP_SPOTIFY_CLIENT_ID = 'test-public-client';
  delete process.env.REACT_APP_REDIRECT_URI;
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  spotify = require('./spotify');
});

afterAll(() => {
  if (originalClientId === undefined) delete process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  else process.env.REACT_APP_SPOTIFY_CLIENT_ID = originalClientId;
  if (originalRedirectUri === undefined) delete process.env.REACT_APP_REDIRECT_URI;
  else process.env.REACT_APP_REDIRECT_URI = originalRedirectUri;
});

describe('PKCE callback', () => {
  it('shares one exchange and its result across repeated callback consumers', async () => {
    seedCallback();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = spotify.exchangeCodeForToken('test-code');
    const second = spotify.exchangeCodeForToken('test-code');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    pending.resolve(response(200, token('new-access', 'new-refresh')));
    expect(await first).toEqual(await second);
    expect((await spotify.exchangeCodeForToken('test-code')).access_token).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('spotify_pkce_verifier')).toBeNull();
    expect(sessionStorage.getItem('spotify_oauth_state')).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(init.body.get('code_verifier')).toBe('test-verifier');
    expect(init.body.get('client_id')).toBe('test-public-client');
    expect(init.body.has('client_secret')).toBe(false);
  });

  it.each([null, 'wrong-state'])('rejects a missing or mismatched OAuth state (%s) before exchange', async (state) => {
    seedCallback();
    window.history.replaceState({}, '', `/callback?code=test-code${state ? `&state=${state}` : ''}`);
    await expect(spotify.exchangeCodeForToken('test-code')).rejects.toThrow(/state|estado/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('spotify_pkce_verifier')).toBeNull();
  });

  it('rejects an unsolicited callback without a stored verifier', async () => {
    window.history.replaceState({}, '', '/callback?code=test-code&state=unsolicited');
    await expect(spotify.exchangeCodeForToken('test-code')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains PKCE data after a transient exchange error so the same callback can retry', async () => {
    seedCallback();
    fetchMock.mockResolvedValueOnce(response(503, { error: 'temporarily_unavailable' }));
    fetchMock.mockResolvedValueOnce(response(200, token()));
    await expect(spotify.exchangeCodeForToken('test-code')).rejects.toMatchObject({ status: 503 });
    expect(sessionStorage.getItem('spotify_pkce_verifier')).toBe('test-verifier');
    await expect(spotify.exchangeCodeForToken('test-code')).resolves.toMatchObject({ access_token: 'test-access' });
  });

  it('does not accept a callback exchange that completes after logout', async () => {
    seedCallback();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const result = spotify.exchangeCodeForToken('test-code');
    spotify.clearSpotifySession();
    pending.resolve(response(200, token()));
    await expect(result).rejects.toMatchObject({ authRequired: true });
    expect(localStorage.getItem('spotify_token')).toBeNull();
  });

  it('does not bypass state validation when the same code is already being exchanged', async () => {
    seedCallback();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = spotify.exchangeCodeForToken('test-code');
    window.history.replaceState({}, '', '/callback?code=test-code&state=wrong-state');
    await expect(spotify.exchangeCodeForToken('test-code')).rejects.toMatchObject({ status: 400, authRequired: true });
    pending.resolve(response(200, token()));
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expires the successful code-exchange cache instead of retaining replayable credentials', async () => {
    seedCallback();
    fetchMock.mockResolvedValueOnce(response(200, token()));
    await spotify.exchangeCodeForToken('test-code');
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 30001);
    try {
      await expect(spotify.exchangeCodeForToken('test-code')).rejects.toMatchObject({ authRequired: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });
});

describe('redirect configuration', () => {
  it('starts a fresh login with independent OAuth state and an S256 challenge, without secrets or added scopes', async () => {
    const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(window, 'crypto');
    const originalEncoder = global.TextEncoder;
    const assign = jest.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://karaoke.example', protocol: 'https:', host: 'karaoke.example', hostname: 'karaoke.example', assign },
    });
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (array: Uint8Array) => require('crypto').randomFillSync(array),
        subtle: { digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)) },
      },
    });
    global.TextEncoder = require('util').TextEncoder;
    try {
      await spotify.startSpotifyLogin();
      const url = new URL(assign.mock.calls[0][0]);
      expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
      expect(url.searchParams.get('state')).toBe(sessionStorage.getItem('spotify_oauth_state'));
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('state')).not.toBe(sessionStorage.getItem('spotify_pkce_verifier'));
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('redirect_uri')).toBe('https://karaoke.example/callback');
      expect(url.searchParams.get('scope')).toBe('user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read');
      expect(url.searchParams.has('client_secret')).toBe(false);
    } finally {
      Object.defineProperty(window, 'location', locationDescriptor);
      if (cryptoDescriptor) Object.defineProperty(window, 'crypto', cryptoDescriptor);
      else Reflect.deleteProperty(window, 'crypto');
      global.TextEncoder = originalEncoder;
    }
  });

  it('uses an explicit loopback IP and transfers login there before storing PKCE', () => {
    expect(spotify.getRedirectUri()).toMatch(/^http:\/\/127\.0\.0\.1(?::\d+)?\/callback$/);
    expect(spotify.getCanonicalLoginUrl()).toMatch(/^http:\/\/127\.0\.0\.1(?::\d+)?\/\?spotify_login=1$/);
    expect(sessionStorage.getItem('spotify_pkce_verifier')).toBeNull();
  });

  it.each(['http://localhost:3000/callback', 'https://localhost/callback', 'http://example.com/callback', 'ftp://example.com/callback', 'not a URL', 'https://user:pass@example.com/callback'])('rejects unsafe redirect %s', async (redirect) => {
    process.env.REACT_APP_REDIRECT_URI = redirect;
    jest.resetModules();
    spotify = require('./spotify');
    await expect(spotify.startSpotifyLogin()).rejects.toThrow(/redirect|redirecci[oó]n|HTTPS|loopback/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['https://example.com/callback', 'http://127.0.0.1:3000/callback', 'http://[::1]:3000/callback'])('accepts the configured HTTPS or loopback redirect %s', (redirect) => {
    process.env.REACT_APP_REDIRECT_URI = redirect;
    jest.resetModules();
    spotify = require('./spotify');
    expect(spotify.getRedirectUri()).toBe(redirect);
    expect(spotify.getRedirectOrigin()).toBe(new URL(redirect).origin);
  });

  it('reports a missing client ID before attempting login', async () => {
    delete process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    jest.resetModules();
    spotify = require('./spotify');
    await expect(spotify.startSpotifyLogin()).rejects.toThrow(/REACT_APP_SPOTIFY_CLIENT_ID/);
  });
});

describe('session restoration and refresh', () => {
  it('restores an unexpired token and its original expiry without a request', async () => {
    seedSession();
    const expiry = localStorage.getItem('token_expiry');
    await expect(spotify.getValidAccessToken()).resolves.toBe('old-access');
    expect(localStorage.getItem('token_expiry')).toBe(expiry);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares expired-token refresh, stores the new expiry, and keeps a nonrotated refresh token', async () => {
    seedSession(true);
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = spotify.getValidAccessToken();
    const second = spotify.getValidAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    pending.resolve(response(200, token('refreshed-access')));
    expect(await Promise.all([first, second])).toEqual(['refreshed-access', 'refreshed-access']);
    expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
    expect(Number(localStorage.getItem('token_expiry'))).toBeGreaterThan(Date.now());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(init.body.get('grant_type')).toBe('refresh_token');
    expect(init.body.get('client_id')).toBe('test-public-client');
    expect(init.body.get('refresh_token')).toBe('test-refresh');
    expect(init.body.has('client_secret')).toBe(false);
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('accepts a rotated refresh token and restores it after a module reload', async () => {
    seedSession(true);
    fetchMock.mockResolvedValueOnce(response(200, token('rotated-access', 'rotated-refresh')));
    await spotify.getValidAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    jest.resetModules();
    spotify = require('./spotify');
    await expect(spotify.getValidAccessToken()).resolves.toBe('rotated-access');
    expect(localStorage.getItem('spotify_refresh_token')).toBe('rotated-refresh');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([500, 503, 429])('preserves the stored session on transient refresh HTTP %s', async (status) => {
    seedSession(true);
    fetchMock.mockResolvedValueOnce(response(status, { error: 'temporarily_unavailable' }, '7'));
    await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status, authRequired: false });
    expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
    expect(localStorage.getItem('spotify_token')).toBe('old-access');
  });

  it('shares a refresh429 cooldown across sequential callers and resumes only after Retry-After', async () => {
    seedSession(true);
    jest.useFakeTimers();
    try {
      fetchMock.mockResolvedValueOnce(response(429, { error: 'rate_limited' }, '7'));
      fetchMock.mockResolvedValueOnce(response(200, token('after-cooldown')));
      await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 429, retryAfter: 7 });
      await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 429, retryAfter: 7 });
      jest.advanceTimersByTime(2000);
      await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 429, retryAfter: 5 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
      jest.advanceTimersByTime(5000);
      await expect(spotify.getValidAccessToken()).resolves.toBe('after-cooldown');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves a refresh token after a network outage and recovers on a later call', async () => {
    seedSession(true);
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    fetchMock.mockResolvedValueOnce(response(200, token('recovered-access')));
    await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 0, authRequired: false });
    expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
    await expect(spotify.getValidAccessToken()).resolves.toBe('recovered-access');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires login and removes tokens when Spotify rejects the refresh grant', async () => {
    seedSession(true);
    fetchMock.mockResolvedValueOnce(response(400, { error: 'invalid_grant' }));
    await expect(spotify.getValidAccessToken()).resolves.toBeNull();
    expect(localStorage.getItem('spotify_token')).toBeNull();
    expect(localStorage.getItem('token_expiry')).toBeNull();
    expect(localStorage.getItem('spotify_refresh_token')).toBeNull();
    await expect(spotify.getValidAccessToken()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discards an expired legacy access token without a refresh token', async () => {
    localStorage.setItem('spotify_token', 'expired-access');
    localStorage.setItem('token_expiry', '1');
    await expect(spotify.getValidAccessToken()).resolves.toBeNull();
    expect(localStorage.getItem('spotify_token')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not restore a session after logout while refresh is pending', async () => {
    seedSession(true);
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const result = spotify.getValidAccessToken();
    spotify.clearSpotifySession();
    pending.resolve(response(200, token('stale-access', 'stale-refresh')));
    await expect(result).resolves.toBeNull();
    expect(localStorage.getItem('spotify_token')).toBeNull();
    expect(localStorage.getItem('spotify_refresh_token')).toBeNull();
  });

  it('rejects malformed token responses without replacing the stored session', async () => {
    seedSession(true);
    fetchMock.mockResolvedValueOnce(response(200, { access_token: '', expires_in: -1 }));
    await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 502 });
    expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
  });

  it('can recover after missing public client configuration without a rejected refresh staying cached', async () => {
    seedSession(true);
    delete process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    await expect(spotify.getValidAccessToken()).rejects.toMatchObject({ status: 400 });
    process.env.REACT_APP_SPOTIFY_CLIENT_ID = 'test-public-client';
    fetchMock.mockResolvedValueOnce(response(200, token('configured-access')));
    await expect(spotify.getValidAccessToken()).resolves.toBe('configured-access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-memory login usable if device token storage is disabled', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled'); });
    try {
      spotify.storeSpotifyToken(token('memory-access', 'memory-refresh'));
      await expect(spotify.getValidAccessToken()).resolves.toBe('memory-access');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('Spotify API requests', () => {
  it('returns null on 204 and forwards the cancellation signal with its own Authorization header', async () => {
    seedSession();
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(response(204));
    await expect(spotify.spotifyRequest('/me/player/currently-playing', { signal: controller.signal })).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me/player/currently-playing');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer old-access');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
    expect(init.credentials).toBe('omit');
    expect(init.redirect).toBe('error');
  });

  it('refreshes once and replays a 401 exactly once', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(response(401));
    fetchMock.mockResolvedValueOnce(response(200, token('renewed-access')));
    fetchMock.mockResolvedValueOnce(response(200, { item: { id: 'fixture-track' } }));
    await expect(spotify.spotifyRequest('/me/player/currently-playing')).resolves.toEqual({ item: { id: 'fixture-track' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer renewed-access');
  });

  it('deduplicates simultaneous 401 refreshes including a late response with the rejected token', async () => {
    seedSession();
    const late = deferred<Response>();
    let oldCalls = 0;
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url === 'https://accounts.spotify.com/api/token') return Promise.resolve(response(200, token('new-access')));
      if (new Headers(init.headers).get('Authorization') === 'Bearer old-access') {
        oldCalls += 1;
        return oldCalls === 1 ? Promise.resolve(response(401)) : late.promise;
      }
      return Promise.resolve(response(200, { ok: true }));
    });
    const first = spotify.spotifyRequest('/me/player/currently-playing');
    const second = spotify.spotifyRequest('/me/player/currently-playing');
    await expect(first).resolves.toEqual({ ok: true });
    late.resolve(response(401));
    await expect(second).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.filter(([url]) => url === 'https://accounts.spotify.com/api/token')).toHaveLength(1);
  });

  it('stops after a repeated 401, clears the session, and requires login', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(response(401));
    fetchMock.mockResolvedValueOnce(response(200, token('rejected-access')));
    fetchMock.mockResolvedValueOnce(response(401));
    await expect(spotify.spotifyRequest('/me/player/currently-playing')).rejects.toMatchObject({ status: 401, authRequired: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('spotify_refresh_token')).toBeNull();
  });

  it.each(['8', new Date(Date.now() + 20000).toUTCString()])('exposes Retry-After in seconds and leaves retry timing to the caller (%s)', async (header) => {
    seedSession();
    fetchMock.mockResolvedValueOnce(response(429, { error: { message: 'rate limited' } }, header));
    const result = spotify.spotifyRequest('/me/player/currently-playing');
    await expect(result).rejects.toBeInstanceOf(spotify.SpotifyRequestError);
    await expect(result).rejects.toMatchObject({ status: 429, authRequired: false });
    await expect(result).rejects.toHaveProperty('retryAfter', expect.any(Number));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
  });

  it('does not refresh on forbidden responses or report them as logout', async () => {
    seedSession();
    fetchMock.mockResolvedValueOnce(response(403, { error: { message: 'not allowed' } }));
    await expect(spotify.spotifyRequest('/me/player/currently-playing')).rejects.toMatchObject({ status: 403, authRequired: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('spotify_token')).toBe('old-access');
  });

  it.each(['https://other.example/me', '//other.example/me', '/\\other.example/me', '/../token', '/%2e%2e/token'])('rejects paths that could leave the fixed Spotify API base (%s)', async (path) => {
    seedSession();
    await expect(spotify.spotifyRequest(path)).rejects.toThrow(/ruta|path/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the API without a session', async () => {
    await expect(spotify.spotifyRequest('/me/player/currently-playing')).rejects.toMatchObject({ status: 401, authRequired: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an API response from the session that was logged out while it was in flight', async () => {
    seedSession();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const result = spotify.spotifyRequest('/me/player/currently-playing');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    spotify.clearSpotifySession();
    pending.resolve(response(200, { item: { id: 'stale-track' } }));
    await expect(result).rejects.toMatchObject({ status: 401, authRequired: true });
    expect(localStorage.getItem('spotify_token')).toBeNull();
  });

  it('does not send a request after its consumer cancels while waiting for a shared refresh', async () => {
    seedSession(true);
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const result = spotify.spotifyRequest('/me/player/currently-playing', { signal: controller.signal });
    controller.abort();
    pending.resolve(response(200, token('new-access')));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds a hanging API call and keeps its refresh session available', async () => {
    seedSession();
    jest.useFakeTimers();
    try {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));
      const result = spotify.spotifyRequest('/me/player/currently-playing').catch((error) => error);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(10000);
      await expect(result).resolves.toMatchObject({ status: 408, authRequired: false });
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
    } finally {
      jest.useRealTimers();
    }
  });

  it('bounds a hanging token refresh and preserves its refresh token for later recovery', async () => {
    seedSession(true);
    jest.useFakeTimers();
    try {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));
      const result = spotify.getValidAccessToken().catch((error) => error);
      jest.advanceTimersByTime(10000);
      await expect(result).resolves.toMatchObject({ status: 408, authRequired: false });
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(localStorage.getItem('spotify_refresh_token')).toBe('test-refresh');
    } finally {
      jest.useRealTimers();
    }
  });
});
