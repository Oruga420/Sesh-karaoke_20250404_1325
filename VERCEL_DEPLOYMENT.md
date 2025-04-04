# Deploying Spotify Karaoke to Vercel

This guide will help you deploy your Spotify Karaoke application to Vercel.

## Prerequisites

1. Create a [Vercel account](https://vercel.com/signup) if you don't have one
2. Connect your GitHub, GitLab, or Bitbucket account to Vercel
3. Have your Spotify API credentials ready:
   - Client ID 
   - Client Secret (needed for server functions)

## Deployment Steps

### Option 1: Deploy via GitHub

1. Push your project to a GitHub repository
2. Log in to your Vercel account
3. Click "New Project"
4. Select your repository
5. Configure the project:
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`

### Option 2: Deploy via Vercel CLI

1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel login` to authenticate
3. Navigate to your project directory
4. Run `vercel` and follow the prompts
5. To deploy to production, run `vercel --prod`

## Environment Variables

Set these environment variables in your Vercel project settings:

### Required Variables
```
REACT_APP_SPOTIFY_CLIENT_ID=your_spotify_client_id
REACT_APP_REDIRECT_URI=https://your-domain.vercel.app/callback
REACT_APP_API_URL=https://your-domain.vercel.app
```

### Optional Variables (if using lyrics APIs)
```
GENIUS_API_KEY=your_genius_api_key
MUSIXMATCH_API_KEY=your_musixmatch_api_key
```

## Post-Deployment

1. Update your Spotify API settings:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
   - Select your application
   - Add `https://your-domain.vercel.app/callback` to the Redirect URIs

2. Test the application by:
   - Navigating to your deployed URL
   - Logging in with Spotify
   - Verifying that lyrics synchronization works

## Troubleshooting

If you encounter issues:

1. Check Vercel deployment logs for errors
2. Verify that environment variables are set correctly
3. Ensure API routes are working by testing `/health` endpoint
4. Make sure your Spotify application has the correct redirect URI

## Custom Domain Setup (Optional)

1. In your Vercel dashboard, go to "Settings" > "Domains"
2. Add your domain and follow instructions to configure DNS settings

## Performance and Monitoring

Enable Vercel Analytics to monitor performance metrics:

1. Go to your Vercel project
2. Navigate to "Analytics" tab
3. Follow instructions to enable Analytics

## Security Best Practices

- Never commit your `.env` file to source control
- Use environment variables for all sensitive information
- Set the appropriate security headers (already configured in vercel.json)