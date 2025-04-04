# Spotify Karaoke Troubleshooting Guide

If you're having issues with the Spotify Karaoke app, follow these steps to diagnose and fix the problems.

## 1. Basic Checks

- **Is Spotify playing?** Make sure you have an active Spotify session with a song playing.
- **Are you logged in?** Verify that you're logged in to Spotify through the app.
- **Browser compatibility:** Try using Chrome or Firefox for best results.

## 2. Debugging the Lyrics Service

If lyrics aren't showing up:

1. **Open browser console** (F12) to see detailed logs and any errors.
2. **Check the `/debug` endpoint** to see API status and configuration.
3. **Test direct lyrics API**: Navigate to `/api/direct-lyrics?title=Test&artist=Artist` - this should always work.

## 3. Check API Connectivity

For API issues:

1. **Verify Happi.dev API key**: Make sure your Happi.dev API key is set in Vercel environment variables.
2. **Check the API URL**: The frontend should connect to the correct API URL (your app's domain in production).
3. **CORS issues**: Verify CORS headers are being set correctly.

## 4. Common Problems and Solutions

### "Loading lyrics..." message with no lyrics appearing

- **Browser console**: Look for network errors or failed API requests.
- **API_URL**: Frontend might be using the wrong API endpoint.
- **CORS issues**: API requests might be blocked by CORS.

### Demo song shows lyrics, but real songs don't

- **Spotify connection**: The app can detect songs but can't fetch lyrics.
- **API key**: Happi.dev API key might not be set or is invalid.
- **API errors**: Check browser console for specific error messages.

### No song detection

- **Spotify authentication**: Refresh your authentication by logging out and back in.
- **Spotify player state**: Make sure a song is actively playing in Spotify.

## 5. Advanced Troubleshooting

For developers:

1. **Test the API directly** with curl or Postman:
   ```
   curl "https://your-app.vercel.app/api/lyrics?title=Test&artist=Artist"
   ```

2. **Verify environment variables** in Vercel:
   - `HAPPI_API_KEY` should be set to your Happi.dev API key.

3. **Check Vercel logs** for any server-side errors.

## Need More Help?

If you're still experiencing issues, please include the following information when seeking help:

1. Browser console logs (screenshots or text)
2. Output from the `/debug` endpoint
3. Steps to reproduce the issue
4. What song was playing when the issue occurred