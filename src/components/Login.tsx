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

  // Function to handle demo mode login
  const handleDemoMode = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Demo mode activated");
    
    // Store a demo token that the app will recognize
    localStorage.setItem('spotify_token', 'demo-mode-token');
    
    // Reload the page to activate demo mode
    window.location.reload();
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
          <>
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
            
            {/* Demo mode option */}
            <button onClick={handleDemoMode} className="login__demo-button">
              TRY OFFLINE MODE
            </button>
          </>
        )}
        
        <p className="login__info">
          Log in with your Spotify account to see synchronized lyrics for the songs you're listening to.
        </p>
        
        <p className="login__disclaimer">
          Offline mode simulates playback without connecting to Spotify.
          Use this if you're having connectivity issues.
        </p>
      </div>
    </div>
  );
}

export default Login;