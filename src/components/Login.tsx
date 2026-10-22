import React, { useCallback, useEffect, useState } from 'react';
import { startSpotifyLogin, getRedirectUri } from '../spotify';
import './Login.css';

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginClick = useCallback(async () => {
    setError(null);
    setIsLoggingIn(true);
    try {
      await startSpotifyLogin();
      // startSpotifyLogin redirects, so this line normally won't run
    } catch (e) {
      console.error('Login start failed:', e);
      setError(e instanceof Error ? e.message : 'Login failed');
      setIsLoggingIn(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_login') !== '1') return;

    params.delete('spotify_login');
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    );
    void handleLoginClick();
  }, [handleLoginClick]);

  return (
    <div className="login">
      <div className="login__container">
        <svg className="login__logo" role="img" aria-label="Spotify logo" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="#1DB954" />
          <g fill="none" stroke="#101a13" strokeWidth="6" strokeLinecap="round">
            <path d="M25 38 Q51 27 78 41" />
            <path d="M29 52 Q51 43 74 55" />
            <path d="M33 66 Q51 59 69 68" />
          </g>
        </svg>

        <h1>Spotify Karaoke</h1>

        {isLoggingIn ? (
          <div>
            <p>Connecting to Spotify...</p>
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <button
            type="button"
            className="login__button"
            onClick={handleLoginClick}
          >
            LOGIN WITH SPOTIFY
          </button>
        )}

        {error && <p className="login__error">{error}</p>}

        <p className="login__info">
          Log in with your Spotify account to see synchronized lyrics for the songs you're listening to.
        </p>

        <details style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          <summary style={{ cursor: 'pointer' }}>Debug · redirect URI</summary>
          <p style={{ wordBreak: 'break-all', marginTop: 8 }}>
            This URI must be in your Spotify app's redirect allowlist:
            <br />
            <code>{getRedirectUri()}</code>
          </p>
        </details>
      </div>
    </div>
  );
}

export default Login;
