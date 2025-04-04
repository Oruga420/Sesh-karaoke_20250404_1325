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

# Try to import optional libraries, but provide fallbacks if they're not available
try:
    import lrclib_api
    LRCLIB_API_AVAILABLE = True
    print("lrclib_api module found")
except ImportError:
    LRCLIB_API_AVAILABLE = False
    print("lrclib_api module not found, using fallback implementation")

try:
    import lrc_kit
    LRC_KIT_AVAILABLE = True
    print("lrc_kit module found")
except ImportError:
    LRC_KIT_AVAILABLE = False
    print("lrc_kit module not found, using fallback implementation")

def fetch_lrclib(artist, title):
    """Fetch lyrics from lrclib.net"""
    try:
        print(f"Searching lrclib for: {title} by {artist}")
        
        # Try using lrclib_api module if available
        if LRCLIB_API_AVAILABLE:
            try:
                print("Using lrclib_api module")
                result = lrclib_api.get(artist_name=artist, track_name=title)
                if result and result.get('syncedLyrics'):
                    print("Found synced lyrics using lrclib_api")
                    return result['syncedLyrics']
            except Exception as e:
                print(f"Error using lrclib_api: {e}")
                # Fall back to manual implementation
        
        # Manual implementation as fallback
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

def parse_lrc_with_lrc_kit(lrc_text):
    """Parse LRC format using lrc-kit library if available"""
    if not LRC_KIT_AVAILABLE:
        return None
    
    try:
        print("Parsing LRC with lrc_kit")
        parsed = lrc_kit.parse(lrc_text)
        
        # Convert to our format
        lyrics_lines = []
        plain_text = []
        
        for lyric in parsed.lyrics:
            # Skip empty lines
            if not lyric.content or lyric.content.strip() == '':
                continue
                
            # Get time in seconds
            time_in_seconds = lyric.timestamp / 1000
            
            # Split content into words
            words = [word.strip() for word in lyric.content.split(' ') if word.strip()]
            
            if words:
                lyrics_lines.append({
                    "time": time_in_seconds,
                    "words": words
                })
                plain_text.append(lyric.content)
        
        if lyrics_lines:
            print(f"Successfully parsed {len(lyrics_lines)} lines with lrc_kit")
            return {
                "lyrics_lines": lyrics_lines,
                "plain_text": plain_text
            }
        return None
    except Exception as e:
        print(f"Error parsing with lrc_kit: {e}")
        return None

def parse_lrc_manually(lrc_text):
    """Manual LRC parsing as a fallback"""
    try:
        print("Parsing LRC manually")
        lyrics_lines = []
        plain_text = []
        
        for line in lrc_text.split('\n'):
            if line.strip():
                # Extract timestamp and text
                if line.startswith('[') and ']' in line:
                    timestamp_end = line.find(']')
                    timestamp_str = line[1:timestamp_end]
                    text = line[timestamp_end + 1:].strip()
                    
                    # Skip metadata lines
                    if ':' in timestamp_str and not timestamp_str[0].isdigit():
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
        
        if lyrics_lines:
            print(f"Successfully parsed {len(lyrics_lines)} lines manually")
            return {
                "lyrics_lines": lyrics_lines,
                "plain_text": plain_text
            }
        return None
    except Exception as e:
        print(f"Error in manual parsing: {e}")
        return None

def create_fallback_lyrics(title, artist):
    """Create fallback lyrics when no lyrics are found"""
    print(f"Creating fallback lyrics for {title} by {artist}")
    
    # Create a template with lyrics-like text
    lyrics_template = f"""[00:00.00]Now playing: {title}
[00:04.00]By: {artist}
[00:08.00]
[00:12.00]Lyrics are not available right now
[00:16.00]But the music plays on
[00:20.00]
[00:24.00]Enjoy the melody and rhythm
[00:28.00]Let the sound move you
[00:32.00]Music connects us all"""
    
    # Parse these lyrics
    lyrics_lines = []
    plain_text = []
    
    for line in lyrics_template.split('\n'):
        if line.strip():
            # Extract timestamp and text
            if line.startswith('[') and ']' in line:
                timestamp_end = line.find(']')
                timestamp_str = line[1:timestamp_end]
                text = line[timestamp_end + 1:].strip()
                
                try:
                    # Parse the timestamp (format: mm:ss.xx)
                    mins, secs = timestamp_str.split(':')
                    time_seconds = float(mins) * 60 + float(secs)
                    
                    # Only add lines with actual text
                    if text:
                        # Split into words
                        words = text.split()
                        lyrics_lines.append({
                            "time": time_seconds,
                            "words": words
                        })
                        plain_text.append(text)
                except ValueError:
                    continue
    
    return {
        "success": True,
        "text": "\n".join(plain_text),
        "synced": lyrics_lines,
        "source": "fallback",
        "lrcRaw": lyrics_template
    }

def fetch_lyrics(artist, title):
    """
    Fetch synchronized lyrics for a song
    Returns a JSON object with the lyrics data
    """
    try:
        # Try to get lyrics from lrclib.net
        lrc = fetch_lrclib(artist, title)
        
        if not lrc:
            print("No synchronized lyrics found, using fallback lyrics")
            # Use fallback lyrics
            result = create_fallback_lyrics(title, artist)
            return json.dumps(result)
        
        # Parse the LRC file - try lrc_kit first, then fallback to manual parsing
        parsed_result = None
        
        if LRC_KIT_AVAILABLE:
            parsed_result = parse_lrc_with_lrc_kit(lrc)
        
        # If lrc_kit failed or is not available, use manual parsing
        if not parsed_result:
            parsed_result = parse_lrc_manually(lrc)
        
        # If both parsing methods failed, use fallback lyrics
        if not parsed_result or not parsed_result.get("lyrics_lines"):
            print("Parsing failed, using fallback lyrics")
            result = create_fallback_lyrics(title, artist)
            return json.dumps(result)
        
        # Return structured lyrics data
        result = {
            "success": True,
            "text": "\n".join(parsed_result["plain_text"]),
            "synced": parsed_result["lyrics_lines"],
            "source": "lrclib.net",
            "lrcRaw": lrc
        }
        
        return json.dumps(result)
    
    except Exception as e:
        print(f"Error fetching lyrics: {e}")
        # Use fallback lyrics on any error
        result = create_fallback_lyrics(title, artist)
        return json.dumps(result)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch synchronized lyrics for a song")
    parser.add_argument("--artist", required=True, help="Artist name")
    parser.add_argument("--title", required=True, help="Song title")
    args = parser.parse_args()
    
    result = fetch_lyrics(args.artist, args.title)
    print(result)