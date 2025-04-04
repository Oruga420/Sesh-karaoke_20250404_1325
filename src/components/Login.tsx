import React, { useState } from 'react';
import { loginUrl } from '../spotify';
import './Login.css';

function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Handle login securely
  const handleLoginClick = () => {
    console.log("Login button clicked, redirecting to Spotify authorization");
    console.log("Login URL:", loginUrl);
    
    // Display Spotify client ID for debugging
    const clientId = loginUrl.match(/client_id=([^&]*)/)?.[1] || 'unknown';
    console.log("Using Spotify Client ID:", clientId);
    
    // Display redirect URI
    const redirectUri = loginUrl.match(/redirect_uri=([^&]*)/)?.[1] || 'unknown';
    console.log("Using redirect URI:", decodeURIComponent(redirectUri));
    
    // Set logging in state
    setIsLoggingIn(true);
    
    // Use direct window location change for more reliable auth flow
    window.location.href = loginUrl;
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
          <a 
            href={loginUrl} 
            className="login__button"
            onClick={(e) => {
              e.preventDefault();
              handleLoginClick();
            }}
          >
            LOGIN WITH SPOTIFY
          </a>
        )}
        
        <p className="login__info">
          Log in with your Spotify account to see synchronized lyrics for the songs you're listening to.
        </p>
      </div>
    </div>
  );
}

export default Login;