@echo off
echo Starting Spotify Karaoke application...

REM Check for Python and install dependencies if needed
echo Checking Python requirements...
cd server
IF EXIST python.exe (
  python -m pip install -r requirements.txt 2>nul
) ELSE IF EXIST py.exe (
  py -m pip install -r requirements.txt 2>nul
) ELSE (
  python3 -m pip install -r requirements.txt 2>nul
)
cd ..

REM Kill any existing Node processes that might be using our ports
echo Stopping any existing Node processes on our ports...
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

REM Start the redirect server separately (authentication)
echo Starting Spotify authentication redirect server...
start cmd /k "cd server && node redirect-server.js"

REM Start the lyrics server
echo Starting lyrics API server...
start cmd /k "cd server && npm install && node server.js"

REM Wait longer for the servers to start
echo Waiting for servers to initialize...
timeout /t 8

REM Start the frontend
echo Starting frontend...
start cmd /k "npm install && npm start"

echo ================================
echo All services are running!
echo ================================
echo 1. Frontend: http://localhost:3000
echo 2. Lyrics API: http://localhost:3001
echo 3. Auth redirect: http://localhost:8888
echo.
echo IMPORTANT: If the app displays connection errors, 
echo try clicking the "TRY OFFLINE MODE" button.
echo.
echo To stop all services, close the command windows.
echo ================================