import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSpotifyLoginAttempt, exchangeCodeForToken, storeSpotifyToken } from '../spotify';
import '../App.css';

function Callback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Procesando autenticación…');
  // StrictMode replays effects; retain the original parameters even after URL cleanup.
  const [callback] = useState(() => new URLSearchParams(window.location.search));

  useEffect(() => {
    const code = callback.get('code');
    const error = callback.get('error');
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanUrl = () => {
      const params = new URLSearchParams(window.location.search);
      ['code', 'state', 'error', 'error_description'].forEach((key) => params.delete(key));
      const search = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
    };
    const returnHome = (delay: number) => {
      redirectTimer = setTimeout(() => {
        if (!cancelled) navigate('/', { replace: true });
      }, delay);
    };
    const cleanup = () => {
      cancelled = true;
      clearTimeout(redirectTimer);
    };

    if (error) {
      clearSpotifyLoginAttempt();
      cleanUrl();
      setStatus(`Error de Spotify: ${error}`);
      returnHome(2500);
      return cleanup;
    }

    if (!code) {
      clearSpotifyLoginAttempt();
      cleanUrl();
      setStatus('No se recibió código de autorización.');
      returnHome(2000);
      return cleanup;
    }

    (async () => {
      try {
        setStatus('Intercambiando código por token…');
        const token = await exchangeCodeForToken(code);
        if (cancelled) return;

        storeSpotifyToken(token);
        cleanUrl();
        setStatus('¡Listo! Redirigiendo…');
        navigate('/', { replace: true });
      } catch (e) {
        if (cancelled) return;
        cleanUrl();
        setStatus(e instanceof Error ? e.message : 'Falló el intercambio de token');
        returnHome(3000);
      }
    })();

    return cleanup;
  }, [callback, navigate]);

  return (
    <div className="app">
      <div className="app__container">
        <h2>Procesando Autenticación</h2>
        <p role="status">{status}</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
}

export default Callback;
