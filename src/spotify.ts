// Spotify authentication config

// Using credentials from environment variables
const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID || '3be3c1962cc44e2d820c6171d9debbf2';
const clientSecret = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET || 'dae664828eee4fe4bf73c1d52eebe63d';

// For production, use the current hostname for the redirectUri
let redirectUri = process.env.REACT_APP_REDIRECT_URI;
if (!redirectUri) {
  // In browser environment, determine the URI based on current host
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.host;
    redirectUri = `${protocol}//${host}/callback`;
  } else {
    // Fallback for server-side rendering
    redirectUri = 'http://localhost:8888/callback';
  }
}

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
  return window.location.hash
    .substring(1)
    .split('&')
    .reduce((initial: any, item) => {
      let parts = item.split('=');
      initial[parts[0]] = decodeURIComponent(parts[1]);
      return initial;
    }, {});
};
