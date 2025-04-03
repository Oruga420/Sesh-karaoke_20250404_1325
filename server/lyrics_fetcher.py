#!/usr/bin/env python3
"""
Lyrics Fetcher - A Python script to fetch synchronized lyrics for Spotify songs
This version doesn't rely on external libraries and implements basic lyrics fetching directly.
"""
import sys
import json
import argparse
import urllib.request
import urllib.parse
import re
import ssl
import time

def fetch_lrclib(artist, title):
    """Fetch lyrics from lrclib.net"""
    try:
        print(f"Searching lrclib for: {title} by {artist}")
        # Prepare parameters
        params = {
            'artist_name': artist,
            'track_name': title,
            'album_name': '',
        }
        
        # Construct URL
        url = f"https://lrclib.net/api/get?{urllib.parse.urlencode(params)}"
        print(f"Requesting: {url}")
        
        # Configure SSL context to bypass certificate verification (not ideal for production)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        # Fetch data
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'SpotifyKaraoke/1.0'}
        )
        
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            data = response.read().decode('utf-8')
            
            # Parse JSON response
            result = json.loads(data)
            
            # Check if we got lyrics
            if response.status == 200 and result.get('syncedLyrics'):
                print("Found synced lyrics on lrclib")
                return result['syncedLyrics']
            else:
                print("No synced lyrics found on lrclib")
                return None
    
    except Exception as e:
        print(f"Error fetching from lrclib: {e}")
        return None

def fetch_lyrics(artist, title):
    """
    Fetch synchronized lyrics for a song
    Returns a JSON object with the lyrics data
    """
    try:
        # Try to get lyrics from lrclib.net
        lrc = fetch_lrclib(artist, title)
        
        if not lrc:
            print("No synchronized lyrics found")
            return json.dumps({
                "success": False,
                "error": "No lyrics found"
            })
        
        # Parse the LRC file
        lyrics_lines = []
        plain_text = []
        
        for line in lrc.split('\n'):
            if line.strip():
                # Extract timestamp and text
                if line.startswith('[') and ']' in line:
                    timestamp_end = line.find(']')
                    timestamp_str = line[1:timestamp_end]
                    text = line[timestamp_end + 1:].strip()
                    
                    # Skip metadata lines
                    if ':' in timestamp_str and not timestamp_str.startswith('0'):
                        continue
                    
                    try:
                        # Parse the timestamp (format: mm:ss.xx)
                        if ':' in timestamp_str:
                            mins, secs = timestamp_str.split(':')
                            time_seconds = float(mins) * 60 + float(secs)
                        else:
                            time_seconds = float(timestamp_str)
                        
                        # Only add lines with actual text
                        if text:
                            # Split into words
                            words = text.split()
                            lyrics_lines.append({
                                "time": time_seconds,
                                "words": words
                            })
                            plain_text.append(text)
                    except ValueError as e:
                        print(f"Error parsing timestamp {timestamp_str}: {e}")
                        continue
        
        if not lyrics_lines:
            print("Parsed lyrics are empty")
            return json.dumps({
                "success": False,
                "error": "Failed to parse lyrics"
            })
        
        # Return structured lyrics data
        result = {
            "success": True,
            "text": "\n".join(plain_text),
            "synced": lyrics_lines,
            "source": "lrclib.net",
            "lrcRaw": lrc
        }
        
        return json.dumps(result)
    
    except Exception as e:
        print(f"Error fetching lyrics: {e}")
        return json.dumps({
            "success": False,
            "error": str(e)
        })

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch synchronized lyrics for a song")
    parser.add_argument("--artist", required=True, help="Artist name")
    parser.add_argument("--title", required=True, help="Song title")
    args = parser.parse_args()
    
    result = fetch_lyrics(args.artist, args.title)
    print(result)