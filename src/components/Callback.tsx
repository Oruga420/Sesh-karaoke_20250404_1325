import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTokenFromUrl } from '../spotify';
import '../App.css';

function Callback() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Log for debugging
    console.log('Callback component mounted, URL:', window.location.href);
    
    // Get token from URL hash
    const hash = getTokenFromUrl();
    console.log('Extracted hash data:', JSON.stringify(hash));
    
    if (hash.access_token) {
      // Store token in localStorage
      localStorage.setItem('spotify_token', hash.access_token);
      
      // Store expiration if available
      if (hash.expires_in) {
        const expiresAt = Date.now() + parseInt(hash.expires_in) * 1000;
        localStorage.setItem('token_expiry', expiresAt.toString());
      }
      
      console.log('Token saved successfully, redirecting to main app...');
      
      // Redirect to home page - IMPORTANT: Use navigate instead of direct URL change
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } else {
      console.error('No access token found in URL');
      // Redirect to home after a short delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    }
  }, [navigate]);
  
  return (
    <div className="app">
      <div className="app__container">
        <h2>Procesando Autenticación</h2>
        <p>Espera mientras te conectamos con Spotify...</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
}

export default Callback;