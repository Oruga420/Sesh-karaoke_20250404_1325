import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCodeForToken } from '../spotify';
import '../App.css';

function Callback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Procesando autenticación…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      setStatus(`Error de Spotify: ${error}`);
      const t = setTimeout(() => navigate('/', { replace: true }), 2500);
      return () => clearTimeout(t);
    }

    if (!code) {
      console.error('No authorization code in callback URL');
      setStatus('No se recibió código de autorización.');
      const t = setTimeout(() => navigate('/', { replace: true }), 2000);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    (async () => {
      try {
        setStatus('Intercambiando código por token…');
        const token = await exchangeCodeForToken(code);
        if (cancelled) return;

        localStorage.setItem('spotify_token', token.access_token);
        const expiresAt = Date.now() + token.expires_in * 1000;
        localStorage.setItem('token_expiry', expiresAt.toString());
        if (token.refresh_token) {
          localStorage.setItem('spotify_refresh_token', token.refresh_token);
        }

        setStatus('¡Listo! Redirigiendo…');
        navigate('/', { replace: true });
      } catch (e) {
        console.error('Token exchange failed:', e);
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : 'Falló el intercambio de token');
        const t = setTimeout(() => navigate('/', { replace: true }), 3000);
        return () => clearTimeout(t);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="app">
      <div className="app__container">
        <h2>Procesando Autenticación</h2>
        <p>{status}</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
}

export default Callback;
