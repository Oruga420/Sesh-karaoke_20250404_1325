#!/bin/bash
# Setup script for Spotify Karaoke server

echo "Setting up Spotify Karaoke server..."

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Check if Python is installed
if command -v python3 &>/dev/null; then
    echo "Python 3 is installed."
else
    echo "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Make the Python script executable
chmod +x lyrics_fetcher.py

echo "Setup complete! You can now run the server with: npm run start"