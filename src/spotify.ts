// Spotify OAuth 2.0 — Authorization Code Flow with PKCE.
//
// Spotify deprecated the Implicit Grant Flow (response_type=token); browsers
// must now use Authorization Code with PKCE. PKCE removes the need for
// a client_secret on the client side.

const clientId = (process.env.REACT_APP_SPOTIFY_CLIENT_ID || '3be3c1962cc44e2d820c6171d9debbf2').trim();

// Determine the redirect URI based on environment.
const configuredRedirectUri = process.env.REACT_APP_REDIRECT_URI?.trim();
let redirectUri = configuredRedirectUri;
if (!redirectUri) {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.host;
    redirectUri = `${protocol}//${host}/callback`;
    try {
      sessionStorage.setItem('spotify_redirect_uri', redirectUri);
    } catch (e) {
      console.error('Failed to store redirect URI in session storage', e);
    }
  } else {
    redirectUri = 'http://localhost:3000/callback';
  }
}

console.log('Spotify redirect URI:', redirectUri);

export const getRedirectUri = (): string => redirectUri as string;

export const getRedirectOrigin = (): string | null => {
  try {
    return new URL(getRedirectUri()).origin;
  } catch (e) {
    console.error('Invalid Spotify redirect URI:', getRedirectUri(), e);
    return null;
  }
};

export const getCanonicalLoginUrl = (): string | null => {
  if (!configuredRedirectUri || typeof window === 'undefined') return null;

  const redirectOrigin = getRedirectOrigin();
  if (!redirectOrigin || redirectOrigin === window.location.origin) return null;

  const loginUrl = new URL('/', redirectOrigin);
  loginUrl.searchParams.set('spotify_login', '1');
  return loginUrl.toString();
};

const scopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
];

const VERIFIER_KEY = 'spotify_pkce_verifier';

// PKCE: random URL-safe string between 43–128 chars
function generateCodeVerifier(): string {
  const arr = new Uint8Array(64);
  window.crypto.getRandomValues(arr);
  return base64urlEncode(arr.buffer);
}

async function sha256(input: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(input);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return window.btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Begin Spotify login. Generates a fresh PKCE verifier+challenge, stores the
 * verifier in sessionStorage, then redirects to Spotify's authorize endpoint.
 */
export async function startSpotifyLogin(): Promise<void> {
  const canonicalLoginUrl = getCanonicalLoginUrl();
  if (canonicalLoginUrl) {
    window.location.assign(canonicalLoginUrl);
    return;
  }

  const verifier = generateCodeVerifier();
  const challenge = base64urlEncode(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri as string,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: scopes.join(' '),
    show_dialog: 'true',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

/**
 * Exchange the authorization code from the callback URL for an access token.
 * The PKCE verifier (saved before the redirect) authenticates the request —
 * no client_secret needed.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing PKCE verifier — login was not started from this browser tab');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri as string,
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }

  // Verifier is single-use; clear after exchange (success or failure handled below)
  sessionStorage.removeItem(VERIFIER_KEY);
  return res.json();
}

export const checkOnlineStatus = (): boolean => navigator.onLine;
