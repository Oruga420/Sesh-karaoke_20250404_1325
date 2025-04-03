@echo off
echo Spotify Karaoke - Diagnostic Tool
echo ====================================

echo.
echo Checking environment...
node check-build.js

echo.
echo Checking if required ports are available...
npx -y is-port-free 3000 3001 8888

echo.
echo Checking if app can build...
echo This may take a moment...
call npm run build --if-present

echo.
echo Diagnostic completed!
echo If you're still experiencing issues, please check the detailed logs above.
echo.
echo Press any key to exit...
pause > nul