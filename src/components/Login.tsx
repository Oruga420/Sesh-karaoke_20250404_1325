import React, { useState } from 'react';
import { startSpotifyLogin } from '../spotify';
import './Login.css';

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginClick = async () => {
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
  };

  return (
    <div className="login">
      <div className="login__container">
        <img
          src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png"
          alt="Spotify logo"
          className="login__logo"
        />

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
      </div>
    </div>
  );
}

export default Login;
