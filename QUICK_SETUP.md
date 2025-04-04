# Quick Setup Guide for Spotify Karaoke App

Follow these simple steps to get your Spotify Karaoke app working perfectly with lyrics.

## Step 1: Get a Happi.dev API Key (Takes 2 Minutes)

1. Go to [Happi.dev](https://happi.dev/)
2. Click "Sign up" in the top right corner
3. Create an account with your email
4. Once logged in, go to your dashboard
5. Copy your API key (it will look something like "abcd1234efgh5678ijkl")

## Step 2: Add the API Key to Vercel

1. Go to your [Vercel dashboard](https://vercel.com/)
2. Click on your Spotify Karaoke project
3. Go to the "Settings" tab
4. Click on "Environment Variables"
5. Add a new variable:
   - NAME: `HAPPI_API_KEY`
   - VALUE: Paste your Happi.dev API key here
6. Click "Save"
7. Go to the "Deployments" tab
8. Click "Redeploy" on your latest deployment

## Step 3: Test Your App

1. Open your Spotify Karaoke app
2. Play a song in Spotify
3. You should now see lyrics for most songs!

## Troubleshooting

If lyrics aren't showing:
- Make sure you entered the API key correctly
- Try some popular songs first (like songs by Taylor Swift, The Weeknd, etc.)
- Check that your Spotify is playing the song correctly

## Free vs. Paid

The free plan from Happi.dev includes:
- 10,000 API calls per month
- No credit card required
- Perfect for personal use

If you need more, paid plans start at just $10/month.

## Need More Help?

If you're still having issues, check the detailed documentation in:
- `HAPPI_API_SETUP.md` - Detailed information about the Happi.dev integration
- `MUSIXMATCH_SETUP.md` - Alternative lyrics provider (requires approval)