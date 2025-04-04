# Spotify Karaoke Server

This server provides synchronized lyrics for Spotify songs using Python's `syncedlyrics` library.

## Prerequisites

- Node.js (v14 or higher)
- Python 3.7 or higher
- pip (Python package manager)

## Installation

1. Install Node.js dependencies:
   ```
   npm install
   ```

2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Make the Python script executable:
   ```
   chmod +x lyrics_fetcher.py
   ```

## Running the server

```
npm run start
```

## How it works

The server uses a Python script (`lyrics_fetcher.py`) to fetch synchronized lyrics from multiple sources using the `syncedlyrics` library. This library searches across providers like Musixmatch, Lrclib, NetEase, Megalobiz, and Genius to find the best synchronized lyrics.

When the client requests lyrics for a song, the server executes the Python script, which returns the lyrics in a structured JSON format.

## API Endpoints

### GET /api/lyrics

Fetches lyrics for a song.

Parameters:
- `title`: The title of the song
- `artist`: The artist name

Response:
```json
{
  "lyrics": {
    "text": "Lyrics as plain text...",
    "synced": [
      { "time": 0, "words": ["First", "line", "words"] },
      { "time": 5, "words": ["Second", "line", "words"] }
    ],
    "source": "syncedlyrics"
  }
}
```

## Troubleshooting

If you encounter issues with the lyrics not being found or displayed correctly:

1. Make sure Python 3 is installed and accessible in your PATH
2. Check that the `syncedlyrics` library is installed correctly
3. Verify the song title and artist name are correctly passed to the API
4. Check server logs for any errors