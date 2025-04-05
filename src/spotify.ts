// Spotify authentication config

// Using credentials from environment variables
const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '3be3c1962cc44e2d820c6171d9debbf2';
const clientSecret = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET || 'dae664828eee4fe4bf73c1d52eebe63d';

// Determine the redirect URI based on environment
let redirectUri = process.env.REACT_APP_REDIRECT_URI;
if (!redirectUri) {
  // In browser environment, determine the URI based on current host
  if (typeof window !== 'undefined') {
    // Always use the current origin for redirect, that way the callback will work 
    // regardless of which Vercel URL is being used for this deployment
    const protocol = window.location.protocol;
    const host = window.location.host;
    
    // For Vercel deployments or production, use /api/callback path
    // For local development, use /callback path
    const callbackPath = window.location.hostname.includes('vercel.app') 
      ? '/api/callback' 
      : '/callback';
    
    redirectUri = `${protocol}//${host}${callbackPath}`;
    
    // Store the redirect URI in session storage to help with debugging
    try {
      sessionStorage.setItem('spotify_redirect_uri', redirectUri);
    } catch (e) {
      console.error('Failed to store redirect URI in session storage', e);
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

// Check if we're connected to the internet
export const checkOnlineStatus = (): boolean => {
  return navigator.onLine;
};
