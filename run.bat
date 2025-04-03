@echo off
echo Starting Spotify Karaoke application...

REM Start the backend servers
start cmd /k "cd server && npm install && npm run start:all"

REM Wait a moment for the servers to start
timeout /t 3

REM Start the frontend
start cmd /k "npm install && npm start"

echo All services are running.
echo To stop, close the command windows.