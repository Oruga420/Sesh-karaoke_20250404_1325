# Spotify Karaoke

A karaoke application that syncs with your Spotify account to display synchronized lyrics for the currently playing song.

## Features

- Spotify authentication using OAuth 2.0
- Displays currently playing song information
- Synchronized lyrics with word-by-word highlighting
- Dynamic visualization effects
- Auto-scrolling lyrics that follow along with the song

## Setup

1. Clone the repository
   ```
   git clone https://github.com/yourusername/spotify-karaoke.git
   cd spotify-karaoke
   ```

2. Install dependencies
   ```
   npm install
   cd server && npm install && cd ..
   ```

3. Configure Spotify credentials
   The app uses the following environment variables:
   ```
   REACT_APP_SPOTIFY_CLIENT_ID=your_spotify_client_id
   REACT_APP_SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   REACT_APP_REDIRECT_URI=http://localhost:8888/callback
   REACT_APP_API_URL=http://localhost:3001
   ```

## Running the Application Locally

### Important: You need to start ALL three services!

The application consists of three parts that need to be running simultaneously:

1. **Frontend React App** (port 3000)
2. **Redirect Server** (port 8888) - Handles Spotify OAuth callbacks
3. **Lyrics API Server** (port 3001) - Provides lyrics data

### Option 1: Start all services at once (recommended)

```
npm run start-all
```

This will start all three services concurrently.

### Option 2: Start each service individually

In separate terminal windows:

```
# Terminal 1: Start the React frontend
npm start

# Terminal 2: Start the redirect server
npm run start-redirect

# Terminal 3: Start the API server
npm run start-api
```

## Deployment to Vercel

This project is configured for easy deployment to Vercel:

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure the following environment variables in Vercel:
   - `REACT_APP_SPOTIFY_CLIENT_ID` - Your Spotify Client ID
   - `REACT_APP_SPOTIFY_CLIENT_SECRET` - Your Spotify Client Secret
   - `REACT_APP_REDIRECT_URI` - Your deployed URL + "/callback"

The project includes a `vercel.json` configuration file to ensure proper routing and serverless function setup.

## Troubleshooting

If you see a black screen or are having other issues:

1. Run the diagnostic script:
   ```
   # Windows
   diagnose.bat
   
   # Mac/Linux
   node check-build.js
   ```

2. Make sure all three servers are running when developing locally:
   - Frontend on port 3000
   - Redirect server on port 8888 
   - API server on port 3001

3. Check if ports are already in use by other applications:
   ```
   npx kill-port 3000 3001 8888
   ```

4. Try clearing your browser cache and local storage

5. Check your browser console for JavaScript errors

## Technologies Used

- React with TypeScript
- Spotify Web API
- Express.js for the backend
- Vercel Serverless Functions for API endpoints