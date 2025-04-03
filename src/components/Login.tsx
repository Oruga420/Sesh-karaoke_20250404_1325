import React, { useState } from 'react';
import { loginUrl } from '../spotify';
import './Login.css';

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Simple function to handle login securely
  const handleLoginClick = () => {
    console.log("Login button clicked, redirecting to:", loginUrl);
    
    // Set logging in state
    setIsLoggingIn(true);
    
    // Use direct window location change for more reliable auth flow
    window.location.href = loginUrl;
  };

  return (
    <div className="login">
      <img 
        src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png" 
        alt="Spotify logo"
        className="login__logo"
      />
      
      {isLoggingIn ? (
        <div>
          <p>Conectando con Spotify...</p>
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <a 
          href={loginUrl} 
          className="login__button"
          onClick={(e) => {
            e.preventDefault();
            handleLoginClick();
          }}
        >
          INICIAR SESIÓN CON SPOTIFY
        </a>
      )}
      
      <p className="login__info">
        Inicia sesión con tu cuenta de Spotify para ver la letra de la canción que estás escuchando sincronizada con la música.
      </p>
    </div>
  );
}

export default Login;