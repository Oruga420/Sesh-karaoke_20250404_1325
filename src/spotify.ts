// Spotify authentication config

// Using credentials from environment variables
const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '3be3c1962cc44e2d820c6171d9debbf2';
const clientSecret = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET || 'dae664828eee4fe4bf73c1d52eebe63d';

// Determine the redirect URI based on environment
let redirectUri = process.env.REACT_APP_REDIRECT_URI;
if (!redirectUri) {
  // In browser environment, determine the URI based on current host
  if (typeof window !== 'undefined') {
    // For Vercel deployments, we need to use the API routes format
    if (window.location.hostname.includes('vercel.app')) {
      redirectUri = `${window.location.origin}/api/callback`;
    } else {
      // For local development or custom domains
      const protocol = window.location.protocol;
      const host = window.location.host;
      redirectUri = `${protocol}//${host}/callback`;
    }
  } else {
    // Fallback for server-side rendering
    redirectUri = 'http://localhost:8888/callback';
  }
}

// Log the redirect URI for debugging
console.log('Spotify redirect URI:', redirectUri);

// Scopes define the access permissions we're asking from the user
const scopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
];

// Generate the Spotify login URL
export const loginUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token&show_dialog=true`;

// Extract the token from the URL after the user logs in
export const getTokenFromUrl = (): any => {
  // Handle when the URL doesn't have a hash
  if (!window.location.hash) {
    return {};
  }
  
  try {
    return window.location.hash
      .substring(1)
      .split('&')
      .reduce((initial: any, item) => {
        const parts = item.split('=');
        if (parts.length === 2) {
          initial[parts[0]] = decodeURIComponent(parts[1]);
        }
        return initial;
      }, {});
  } catch (error) {
    console.error('Error parsing URL hash:', error);
    return {};
  }
};

// Check if we're in offline/demo mode
export const isDemoMode = (): boolean => {
  const token = localStorage.getItem('spotify_token');
  return token === 'demo-mode-token';
};

// Check if we're connected to the internet
export const checkOnlineStatus = (): boolean => {
  return navigator.onLine;
};
