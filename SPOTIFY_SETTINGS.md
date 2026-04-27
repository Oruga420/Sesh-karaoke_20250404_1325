# Spotify Application Settings

## Current Configuration
- Client ID: 3be3c1962cc44e2d820c6171d9debbf2
- Production redirect URI in our app: https://sesh-karaoke.vercel.app/callback
- Local development redirect URI: http://localhost:3000/callback

## Important Notes About Spotify Authentication

1. The production application has been configured to use the canonical redirect URI:
   - https://sesh-karaoke.vercel.app/callback

2. If you receive an "INVALID_CLIENT: Invalid redirect URI" error, here's how to fix it:
   - Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
   - Select your application (with Client ID: 3be3c1962cc44e2d820c6171d9debbf2)
   - Click "Edit Settings"
   - Under "Redirect URIs", add: https://sesh-karaoke.vercel.app/callback
   - Save the changes

3. You may need to add this additional redirect URI for local development:
   - http://localhost:3000/callback (for direct React development)

## Using the Application

1. Start the frontend and API servers:
   ```
   npm run start-all
   ```

2. Open your browser to http://localhost:3000

3. Click "LOGIN WITH SPOTIFY" to authenticate

4. Play a song on Spotify to see the lyrics and karaoke display
