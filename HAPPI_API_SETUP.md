# Setting Up Happi.dev API for Spotify Karaoke

This guide explains how to set up the Happi.dev API for quick and reliable lyrics in your Spotify Karaoke app.

## Why Use Happi.dev?

Happi.dev offers several advantages:
- **Instant access**: Get your API key immediately
- **Generous free tier**: 10,000 requests/month on the free plan
- **Affordable pricing**: Paid plans start at just $10/month
- **Easy setup**: No lengthy approval process
- **Reliable lyrics data**: Good coverage of popular songs

## Step 1: Sign up for a Happi.dev Account

1. Go to [Happi.dev](https://happi.dev/)
2. Click "Sign up" to create an account
3. Complete the registration process

## Step 2: Get Your API Key

1. After signing in, go to your Happi.dev dashboard
2. Navigate to the "API Keys" section
3. Copy your API key - you'll need it for the next step

## Step 3: Set Up the API Key in Vercel

1. Log in to your [Vercel dashboard](https://vercel.com/)
2. Select your Spotify Karaoke project
3. Go to "Settings" > "Environment Variables"
4. Add a new environment variable:
   - Name: `HAPPI_API_KEY`
   - Value: Your Happi.dev API key
5. Click "Save"
6. Redeploy your application

## Step 4: Testing

1. Open your Spotify Karaoke app
2. Play a song on Spotify
3. The app should now fetch lyrics from Happi.dev

## Pricing and Usage Limits

Happi.dev offers several tiers:
- **Free tier**: 10,000 API calls per month
- **Basic tier**: $10/month for 50,000 API calls
- **Pro tier**: $30/month for 200,000 API calls

For personal or small-scale use, the free tier is likely sufficient.

## Troubleshooting

If lyrics are not showing up:
1. Check the browser console for errors
2. Verify that the environment variable is set correctly in Vercel
3. Ensure your API key is valid
4. The app will automatically fall back to built-in lyrics if the API fails

## Alternative Options

If you prefer to try another service, the app also supports:

1. **Musixmatch API**: Higher quality but requires application approval (see MUSIXMATCH_SETUP.md)
2. **Built-in lyrics**: Works without any API key with a limited set of popular songs

## Need Help?

If you need assistance with setting up the Happi.dev API, feel free to reach out for support.