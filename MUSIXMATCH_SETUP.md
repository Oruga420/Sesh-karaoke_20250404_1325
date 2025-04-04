# Setting Up Musixmatch API for Spotify Karaoke

This guide explains how to set up the Musixmatch API for more reliable lyrics in your Spotify Karaoke app.

## Why Use Musixmatch?

Musixmatch is one of the largest lyrics databases with:
- Over 14 million lyrics
- Synced lyrics with timestamps
- Used by Spotify, Apple Music, and other major platforms
- Official licensing for lyrics content

## Step 1: Sign up for a Musixmatch Developer Account

1. Go to [Musixmatch Developer portal](https://developer.musixmatch.com/)
2. Click "SIGN UP" to create a developer account
3. Complete the registration process

## Step 2: Get Your API Key

1. After signing in, go to your Musixmatch Developer dashboard
2. Find your API key (usually listed prominently on your dashboard)
3. Copy this key - you'll need it for the next step

## Step 3: Set Up the API Key in Vercel

1. Log in to your [Vercel dashboard](https://vercel.com/)
2. Select your Spotify Karaoke project
3. Go to "Settings" > "Environment Variables"
4. Add a new environment variable:
   - Name: `MUSIXMATCH_API_KEY`
   - Value: Your Musixmatch API key
5. Click "Save"
6. Redeploy your application

## Step 4: Testing

1. Open your Spotify Karaoke app
2. Play a song on Spotify
3. The app should now fetch lyrics from Musixmatch

## Pricing and Usage Limits

Musixmatch offers several tiers:
- **Free tier**: Limited to 2,000 API calls per day
- **Commercial tiers**: Starting from $199/month with higher limits

For a personal project or small-scale usage, the free tier should be sufficient.

## Troubleshooting

If lyrics are not showing up:
1. Check the browser console for errors
2. Verify that the environment variable is set correctly in Vercel
3. Ensure your API key is valid
4. The app will automatically fall back to built-in lyrics if Musixmatch fails

## Alternative Paid Lyrics APIs

If Musixmatch doesn't meet your needs, consider these alternatives:

1. **Genius API**: https://docs.genius.com/
2. **LyricFind**: https://www.lyricfind.com/services/
3. **Audd.io Lyrics API**: https://docs.audd.io/lyrics/ (from $9/month)

## Need Help?

If you need assistance setting up the Musixmatch API, feel free to reach out for support.