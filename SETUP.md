# Spotify Karaoke Setup Guide

This guide will help you set up your Spotify Karaoke app with lyrics from Happi.dev.

## Step 1: Get a Happi.dev API Key

1. Go to [Happi.dev](https://happi.dev/)
2. Sign up for an account (it's free)
3. After logging in, you'll see your API key on the dashboard
4. Copy this API key for the next step

## Step 2: Configure Your Vercel Project

1. Go to your [Vercel dashboard](https://vercel.com/)
2. Select your Spotify Karaoke project
3. Go to "Settings" > "Environment Variables"
4. Add a new variable:
   - Name: `HAPPI_API_KEY`
   - Value: Paste your Happi.dev API key
5. Click "Save"
6. Go to "Deployments" and trigger a new deployment

## Step 3: Test Your App

After deploying, your app should now fetch lyrics from Happi.dev when you play songs on Spotify.

## How It Works

1. When you play a song in Spotify, the app detects the current song
2. The app sends the song title and artist to the lyrics API
3. The API queries Happi.dev to find matching lyrics
4. The lyrics are displayed and synchronized with the music

## Troubleshooting

If lyrics aren't showing correctly:

1. Check your browser console for errors
2. Verify your Happi.dev API key is correctly set in Vercel
3. Try playing a popular song (Happi.dev has better coverage for popular songs)
4. Refresh your page and try again

## About Happi.dev

- Free tier: 10,000 API calls per month
- No credit card required
- Extensive lyrics database
- Fast and reliable API

If you need more API calls, Happi.dev offers paid plans starting at $10/month.