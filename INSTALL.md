# Installation Guide for Spotify Karaoke

This guide will help you set up and run the Spotify Karaoke application.

## Prerequisites

Before you begin, make sure you have the following installed:

1. **Node.js** (v14 or later) and **npm** - Download from [nodejs.org](https://nodejs.org/)
2. **Git** (optional if you're downloading as a ZIP) - Download from [git-scm.com](https://git-scm.com/)

## Step 1: Create a Spotify Developer Application

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the app details:
   - App name: "Spotify Karaoke" (or whatever you prefer)
   - App description: "A karaoke app that syncs with Spotify"
   - Redirect URI: `http://localhost:3000/callback`
5. Accept the terms and conditions
6. Once created, note your **Client ID** - you'll need it in the next steps

## Step 2: Set Up the Application

### Clone or Download the Repository

```bash
git clone https://github.com/yourusername/spotify-karaoke.git
cd spotify-karaoke
```

Or download and extract the ZIP file.

### Configure Environment Variables

1. Create a `.env` file in the main project directory:

```bash
cp .env.example .env
```

2. Edit the `.env` file and add your Spotify Client ID:

```
REACT_APP_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
REACT_APP_REDIRECT_URI=http://localhost:3000/callback
REACT_APP_API_URL=http://localhost:3001
```

3. Create a `.env` file in the server directory:

```bash
cp server/.env.example server/.env
```

## Step 3: Install Dependencies

Install dependencies for both the frontend and backend:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

## Step 4: Running the Application

### Using the Convenience Scripts (Recommended)

This will start all necessary servers including the authentication redirect server.

#### For Windows users:

Simply double-click the `run.bat` file or run it from the command line:

```bash
run.bat
```

#### For Linux/Mac users:

```bash
chmod +x run.sh  # Make the script executable (if not already)
./run.sh
```

### Manual Start

If you prefer to start the services manually:

1. Start both backend servers (main API and redirect server):

```bash
cd server
npm install
npm run start:all
```

This will start:
- The main API server on port 3001
- The redirect server on port 8888 (for Spotify callbacks)

2. In a new terminal, start the frontend:

```bash
# From the project root
npm install
npm start
```

## Step 5: Access the Application

1. Open your browser and go to [http://localhost:3000](http://localhost:3000)
2. Click "LOGIN WITH SPOTIFY" to authenticate with your Spotify account
3. Start playing a song on Spotify (using any Spotify app or web player)
4. The app will display the song details and lyrics with synchronized highlighting

## Troubleshooting

- **Authentication Issues**: Make sure your Client ID is correctly entered in the `.env` file
- **No Song Detected**: Ensure you have an active Spotify session with a song playing
- **Backend Connection Error**: Verify that the backend server is running on port 3001

## Next Steps

- To integrate with real lyrics APIs, check the README.md file for guidance
- For development and contribution information, refer to the project's README.md

## License

This project is licensed under the MIT License - see the LICENSE file for details.