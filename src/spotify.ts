// Browser-only Authorization Code with PKCE: no client secret is used here.
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const REQUEST_TIMEOUT = 10000;
const EXCHANGE_CACHE_TTL = 30000;
const VERIFIER_KEY = 'spotify_pkce_verifier';
const STATE_KEY = 'spotify_oauth_state';
const REDIRECT_KEY = 'spotify_redirect_uri';
const scopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
];

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
}

export class SpotifyRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter: number | null = null,
    public readonly authRequired = false,
  ) {
    super(message);
    this.name = 'SpotifyRequestError';
    Object.setPrototypeOf(this, SpotifyRequestError.prototype);
  }
}

interface Session {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;
}

// A session remains usable in this tab if browser storage becomes unavailable.
let session: Session | null | undefined;
let generation = 0;
let refreshFlight: { token: string; generation: number; promise: Promise<string | null> } | null = null;
let refreshCooldown: { token: string; generation: number; until: number; message: string } | null = null;
// One entry also covers a callback consumer mounted just after exchange finishes.
let exchangeFlight: { code: string; state: string | null; completedAt: number | null; generation: number; promise: Promise<TokenResponse> } | null = null;

function getClientId(): string {
  const value = process.env.REACT_APP_SPOTIFY_CLIENT_ID?.trim();
  if (!value || value === 'your_spotify_client_id') {
    throw new SpotifyRequestError('Configura REACT_APP_SPOTIFY_CLIENT_ID para conectar Spotify.', 400);
  }
  return value;
}

export const getRedirectUri = (): string => {
  const configured = process.env.REACT_APP_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (typeof window === 'undefined') return 'http://127.0.0.1:3000/callback';
  const uri = new URL('/callback', window.location.origin);
  // Transfer to this origin before creating state/verifier; sessionStorage is
  // origin-bound, and Spotify does not accept localhost as a redirect hostname.
  if (uri.hostname === 'localhost') uri.hostname = '127.0.0.1';
  return uri.toString();
};

function validateRedirectUri(value: string): string {
  let uri: URL;
  try {
    uri = new URL(value);
  } catch {
    throw new SpotifyRequestError('La redirección de Spotify debe ser una URL HTTPS o de loopback válida.', 400);
  }
  const loopback = uri.hostname === '127.0.0.1' || uri.hostname === '[::1]';
  if (uri.hostname === 'localhost' || uri.username || uri.password || uri.hash ||
      (uri.protocol !== 'https:' && !(uri.protocol === 'http:' && loopback))) {
    throw new SpotifyRequestError('La redirección de Spotify requiere HTTPS o http://127.0.0.1; localhost no está permitido.', 400);
  }
  return value;
}

export const getRedirectOrigin = (): string | null => {
  try {
    return new URL(validateRedirectUri(getRedirectUri())).origin;
  } catch {
    return null;
  }
};

export const getCanonicalLoginUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const origin = getRedirectOrigin();
  if (!origin || origin === window.location.origin) return null;
  const url = new URL('/', origin);
  url.searchParams.set('spotify_login', '1');
  return url.toString();
};

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(): string {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64urlEncode(bytes.buffer);
}

export function clearSpotifyLoginAttempt(): void {
  try {
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // Storage can be disabled after login has already started.
  }
}

export async function startSpotifyLogin(): Promise<void> {
  const clientId = getClientId();
  const redirectUri = validateRedirectUri(getRedirectUri());
  const canonicalUrl = getCanonicalLoginUrl();
  if (canonicalUrl) {
    window.location.assign(canonicalUrl);
    return;
  }

  const verifier = randomString();
  const state = randomString();
  const challenge = base64urlEncode(await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  generation += 1;
  exchangeFlight = null;
  refreshCooldown = null;
  clearSpotifyLoginAttempt();
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(REDIRECT_KEY, redirectUri);
  } catch {
    clearSpotifyLoginAttempt();
    throw new SpotifyRequestError('Permite el almacenamiento de esta pestaña para conectar Spotify.', 400);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: scopes.join(' '),
    show_dialog: 'true',
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

function getSession(): Session | null {
  if (session !== undefined) return session;
  try {
    const accessToken = localStorage.getItem('spotify_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    const expiresAt = Number(localStorage.getItem('token_expiry'));
    session = accessToken || refreshToken ? { accessToken, refreshToken, expiresAt } : null;
  } catch {
    session = null;
  }
  return session;
}

function validateToken(value: unknown): TokenResponse {
  const token = value as TokenResponse | null;
  if (!token || typeof token.access_token !== 'string' || !token.access_token.trim() ||
      typeof token.expires_in !== 'number' || !Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
      (token.refresh_token !== undefined && (typeof token.refresh_token !== 'string' || !token.refresh_token.trim()))) {
    throw new SpotifyRequestError('Spotify devolvió una respuesta de token inválida.', 502);
  }
  return token;
}

export function storeSpotifyToken(value: TokenResponse): void {
  const token = validateToken(value);
  const refreshToken = token.refresh_token ?? getSession()?.refreshToken ?? null;
  const expiresAt = Date.now() + token.expires_in * 1000;
  session = { accessToken: token.access_token, refreshToken, expiresAt };
  try {
    localStorage.setItem('spotify_token', token.access_token);
    localStorage.setItem('token_expiry', String(expiresAt));
    if (refreshToken) localStorage.setItem('spotify_refresh_token', refreshToken);
    else localStorage.removeItem('spotify_refresh_token');
  } catch {
    // Keep the valid in-memory session; never log token/storage contents.
  }
}

export function clearSpotifySession(): void {
  generation += 1;
  session = null;
  refreshFlight = null;
  refreshCooldown = null;
  exchangeFlight = null;
  clearSpotifyLoginAttempt();
  try {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('spotify_refresh_token');
  } catch {
    // The in-memory session is still cleared when storage is disabled.
  }
}

function retryAfterSeconds(value: string | null): number | null {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null;
}

function abortError(): DOMException {
  return new DOMException('Solicitud cancelada.', 'AbortError');
}

/** Bound both fetch and body reading, while preserving consumer cancellation. */
async function requestJson(url: string, init: RequestInit): Promise<{ response: Response; data: unknown }> {
  if (init.signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  init.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT);
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(timedOut
      ? new SpotifyRequestError('Spotify tardó demasiado en responder. Inténtalo de nuevo.', 408)
      : abortError()), { once: true });
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal, credentials: 'omit', redirect: 'error' });
        let data: unknown = null;
        if (response.status !== 204) {
          try {
            data = await response.json();
          } catch {
            if (response.ok) throw new SpotifyRequestError('Spotify devolvió una respuesta inválida.', 502);
          }
        }
        return { response, data };
      })(),
      aborted,
    ]);
  } catch (error) {
    if (error instanceof SpotifyRequestError || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new SpotifyRequestError('No se pudo conectar con Spotify. Inténtalo de nuevo.', 0);
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const { response, data } = await requestJson(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) {
    const expired = (data as { error?: string } | null)?.error === 'invalid_grant';
    throw new SpotifyRequestError(
      expired ? 'La sesión de Spotify caducó. Vuelve a conectar tu cuenta.' : 'No se pudo obtener el token de Spotify. Inténtalo de nuevo.',
      response.status, retryAfterSeconds(response.headers.get('Retry-After')), expired,
    );
  }
  return validateToken(data);
}

export function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const params = new URLSearchParams(window.location.search);
  if (exchangeFlight?.code === code && exchangeFlight.generation === generation &&
      (exchangeFlight.completedAt === null || Date.now() - exchangeFlight.completedAt < EXCHANGE_CACHE_TTL)) {
    if (params.get('state') !== exchangeFlight.state || params.get('code') !== code) {
      return Promise.reject(new SpotifyRequestError('El estado (state) de Spotify no coincide. Vuelve a iniciar sesión.', 400, null, true));
    }
    return exchangeFlight.promise;
  }
  const startedAt = generation;
  const flight = { code, state: null as string | null, completedAt: null as number | null, generation: startedAt, promise: Promise.resolve({} as TokenResponse) };
  flight.promise = (async () => {
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    const expectedState = sessionStorage.getItem(STATE_KEY);
    if (!code || !verifier) throw new SpotifyRequestError('Vuelve a iniciar sesión en esta pestaña: falta el verificador PKCE.', 401, null, true);
    if (!expectedState || params.get('state') !== expectedState || params.get('code') !== code) {
      clearSpotifyLoginAttempt();
      throw new SpotifyRequestError('El estado (state) de Spotify no coincide. Vuelve a iniciar sesión.', 400, null, true);
    }
    flight.state = expectedState;
    const redirectUri = validateRedirectUri(sessionStorage.getItem(REDIRECT_KEY) || getRedirectUri());
    const token = await requestToken(new URLSearchParams({
      client_id: getClientId(), grant_type: 'authorization_code', code,
      redirect_uri: redirectUri, code_verifier: verifier,
    }));
    if (startedAt !== generation) throw new SpotifyRequestError('La conexión de Spotify fue cancelada.', 401, null, true);
    flight.completedAt = Date.now();
    clearSpotifyLoginAttempt();
    return token;
  })().catch((error: unknown) => {
    if (exchangeFlight === flight) exchangeFlight = null;
    if (error instanceof SpotifyRequestError && error.authRequired && startedAt === generation) clearSpotifyLoginAttempt();
    throw error;
  });
  exchangeFlight = flight;
  return flight.promise;
}

function refreshAccessToken(rejectedToken?: string): Promise<string | null> {
  const current = getSession();
  if (rejectedToken && current?.accessToken && current.accessToken !== rejectedToken && current.expiresAt > Date.now()) {
    return Promise.resolve(current.accessToken);
  }
  if (!current?.refreshToken) {
    clearSpotifySession();
    return Promise.resolve(null);
  }
  if (refreshCooldown?.token === current.refreshToken && refreshCooldown.generation === generation) {
    const remaining = Math.ceil((refreshCooldown.until - Date.now()) / 1000);
    if (remaining > 0) return Promise.reject(new SpotifyRequestError(refreshCooldown.message, 429, remaining));
    refreshCooldown = null;
  }
  if (refreshFlight?.token === current.refreshToken && refreshFlight.generation === generation) return refreshFlight.promise;
  const refreshToken = current.refreshToken;
  const startedAt = generation;
  const flight = { token: refreshToken, generation: startedAt, promise: Promise.resolve<string | null>(null) };
  flight.promise = (async () => {
    try {
      const token = await requestToken(new URLSearchParams({
        client_id: getClientId(), grant_type: 'refresh_token', refresh_token: refreshToken,
      }));
      if (startedAt !== generation) return null;
      storeSpotifyToken(token);
      refreshCooldown = null;
      return token.access_token;
    } catch (error) {
      if (startedAt !== generation) return null;
      if (error instanceof SpotifyRequestError && error.authRequired) {
        clearSpotifySession();
        return null;
      }
      if (error instanceof SpotifyRequestError && error.status === 429) {
        refreshCooldown = {
          token: refreshToken, generation: startedAt,
          until: Date.now() + (error.retryAfter ?? 30) * 1000,
          message: error.message,
        };
      }
      throw error;
    }
  })().finally(() => {
    if (refreshFlight === flight) refreshFlight = null;
  });
  refreshFlight = flight;
  return flight.promise;
}

export function getValidAccessToken(): Promise<string | null> {
  const current = getSession();
  if (current?.accessToken && current.expiresAt > Date.now()) return Promise.resolve(current.accessToken);
  return refreshAccessToken();
}

function apiUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new SpotifyRequestError('Ruta de Spotify inválida.', 400);
  }
  const url = new URL(`${API_BASE}${path}`);
  if (url.origin !== 'https://api.spotify.com' || !url.pathname.startsWith('/v1/') || url.hash) {
    throw new SpotifyRequestError('Ruta de Spotify inválida.', 400);
  }
  return url.toString();
}

export async function spotifyRequest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const url = apiUrl(path);
  const startedAt = generation;
  let accessToken = await getValidAccessToken();
  if (init.signal?.aborted) throw abortError();
  if (!accessToken) throw new SpotifyRequestError('Vuelve a conectar Spotify.', 401, null, true);
  if (startedAt !== generation) throw new SpotifyRequestError('La conexión de Spotify fue cancelada.', 401, null, true);
  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return requestJson(url, { ...init, headers });
  };
  let result = await send(accessToken);
  if (startedAt !== generation) throw new SpotifyRequestError('La conexión de Spotify fue cancelada.', 401, null, true);
  if (result.response.status === 401) {
    accessToken = await refreshAccessToken(accessToken);
    if (init.signal?.aborted) throw abortError();
    if (!accessToken) throw new SpotifyRequestError('Vuelve a conectar Spotify.', 401, null, true);
    result = await send(accessToken);
  }
  if (startedAt !== generation) throw new SpotifyRequestError('La conexión de Spotify fue cancelada.', 401, null, true);
  if (!result.response.ok) {
    const unauthorized = result.response.status === 401;
    if (unauthorized && startedAt === generation) clearSpotifySession();
    throw new SpotifyRequestError(
      unauthorized ? 'Vuelve a conectar Spotify.' : `Spotify respondió con un error (${result.response.status}).`,
      result.response.status, retryAfterSeconds(result.response.headers.get('Retry-After')), unauthorized,
    );
  }
  return result.response.status === 204 ? null : result.data as T;
}

export const checkOnlineStatus = (): boolean => navigator.onLine;
