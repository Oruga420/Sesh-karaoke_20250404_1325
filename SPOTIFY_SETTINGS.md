# Spotify Application Settings

## Current Configuration
- Client ID: 3be3c1962cc44e2d820c6171d9debbf2
- Redirect URI in our app: http://localhost:8888/callback

## Important Notes About Spotify Authentication

1. The application has been configured to use the redirect URI: http://localhost:8888/callback

2. If you receive an "INVALID_CLIENT: Invalid redirect URI" error, here's how to fix it:
   - Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
   - Select your application (with Client ID: 3be3c1962cc44e2d820c6171d9debbf2)
   - Click "Edit Settings"
   - Under "Redirect URIs", add: http://localhost:8888/callback
   - Save the changes

3. You may need to add additional redirect URIs if required:
   - http://localhost:3000/callback (for direct React development)
   - http://localhost:8888/callback (for OAuth flow)

## Using the Application

1. Start both the frontend and backend servers:
   ```
   npm start
   ```

2. In another terminal:
   ```
   cd server
   npm start
   ```

3. Open your browser to http://localhost:3000

4. Click "LOGIN WITH SPOTIFY" to authenticate

5. Play a song on Spotify to see the lyrics and karaoke display