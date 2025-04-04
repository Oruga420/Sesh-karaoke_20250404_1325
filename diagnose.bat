@echo off
echo Spotify Karaoke - Diagnostic and Fix Tool
echo ==========================================

echo.
echo Step 1: Checking and fixing .env files...
echo.

REM Check if root .env file exists, create if not
if not exist ".env" (
    echo Creating root .env file...
    (
        echo # Spotify Setup
        echo REACT_APP_SPOTIFY_CLIENT_ID=3be3c1962cc44e2d820c6171d9debbf2
        echo REACT_APP_SPOTIFY_CLIENT_SECRET=dae664828eee4fe4bf73c1d52eebe63d
        echo REACT_APP_REDIRECT_URI=http://localhost:8888/callback
        echo.
        echo # Backend API - Make sure this matches the server port
        echo REACT_APP_API_URL=http://localhost:3001
    ) > .env
    echo Root .env file created!
) else (
    echo Root .env file exists
)

REM Check if server .env file exists, create if not
if not exist "server\.env" (
    echo Creating server .env file...
    (
        echo # Server config
        echo PORT=3001
        echo.
        echo # Spotify credentials
        echo SPOTIFY_CLIENT_ID=3be3c1962cc44e2d820c6171d9debbf2
        echo SPOTIFY_CLIENT_SECRET=dae664828eee4fe4bf73c1d52eebe63d
        echo SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
    ) > server\.env
    echo Server .env file created!
) else (
    echo Server .env file exists
)

echo.
echo Step 2: Killing any existing processes on our ports...
echo.

FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') DO (
    echo Killing process: %%P on port 3000
    taskkill /F /PID %%P >nul 2>&1
)
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') DO (
    echo Killing process: %%P on port 3001
    taskkill /F /PID %%P >nul 2>&1
)
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr ":8888" ^| findstr "LISTENING"') DO (
    echo Killing process: %%P on port 8888
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo Step 3: Installing dependencies...
echo.

echo Installing npm packages...
call npm install

echo Installing server npm packages...
cd server
call npm install
cd ..

echo Installing Python packages...
python --version 2>NUL
if %ERRORLEVEL% EQU 0 (
    echo Python is installed
    python -m pip install -r server/requirements.txt
) else (
    python3 --version 2>NUL
    if %ERRORLEVEL% EQU 0 (
        echo Python3 is installed
        python3 -m pip install -r server/requirements.txt
    ) else (
        echo WARNING: Python is not installed or not in PATH
    )
)

echo.
echo Step 4: Starting services...
echo.

echo Starting redirect server...
start cmd /k "cd server && node redirect-server.js"

echo Starting lyrics API server...
start cmd /k "cd server && node server.js"

echo Waiting for servers to initialize...
timeout /t 8

echo Starting React app...
start cmd /k "npm start"

echo.
echo ============================================================
echo Spotify Karaoke is now running with fixed configuration!
echo ============================================================
echo 1. Visit http://localhost:3000 in your browser
echo 2. Login with your Spotify account
echo 3. Lyrics should now appear for your songs
echo.
echo If you're still experiencing issues:
echo - Close all command windows and run run.bat again
echo - Try the TRY OFFLINE MODE button on the login screen
echo.
echo Press any key to exit this window...
pause > nul