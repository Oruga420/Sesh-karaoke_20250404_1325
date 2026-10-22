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
      setError(e instanceof Error ? e.message : 'No se pudo conectar Spotify. Inténtalo de nuevo.');
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
    <section className="login" aria-labelledby="spotify-connection-title">
      <h2 id="spotify-connection-title">¿Ya suena en Spotify?</h2>
      <p className="login__info">Conecta tu cuenta para abrir las letras de la canción que escuchas. También puedes buscar sin conectar.</p>
      <button
        type="button"
        className="login__button"
        onClick={handleLoginClick}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? 'Conectando…' : 'Conectar Spotify'}
      </button>
      {isLoggingIn && <p className="login__status" role="status">Abriendo Spotify…</p>}
      {error && <p className="login__error" role="alert">{error}</p>}
      <details className="login__help">
        <summary>Ayuda de conexión</summary>
        <p>Si Spotify rechaza la conexión, comprueba que esta dirección figure entre las redirecciones permitidas de tu aplicación:</p>
        <code>{getRedirectUri()}</code>
      </details>
    </section>
  );
}

export default Login;
