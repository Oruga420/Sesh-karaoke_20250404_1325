@echo off
setlocal enabledelayedexpansion

echo Starting GitHub repository update script...

:: Create log file
set "log_file=%TEMP%\github_update_log.txt"
echo Starting script execution at %date% %time% > "%log_file%"

:: Check for Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Git is not installed or not in the system PATH.
    echo Please install Git and try again.
    goto :error
)

:: Get GitHub information directly
set /p "github_username=Enter your GitHub username: "
set /p "repo_name=Enter your GitHub repository name (ONLY the name, NOT the full URL): "
set /p "github_token=Enter your GitHub personal access token: "

:: Clean up repo name (remove URL if accidentally entered)
if "!repo_name:~0,8!"=="https://" (
    echo WARNING: You entered a URL instead of just the repository name.
    echo Attempting to extract repository name from URL...
    
    :: Extract repo name from URL
    for /f "tokens=5 delims=/" %%a in ("!repo_name!") do (
        set "repo_name=%%a"
    )
    
    :: Remove any .git extension
    set "repo_name=!repo_name:.git=!"
    
    echo Extracted repository name: !repo_name!
)

:: Log the info (except token for security)
echo GitHub username: %github_username% >> "%log_file%"
echo Repository name: %repo_name% >> "%log_file%"
echo GitHub token received (not logged for security) >> "%log_file%"

:: Check if current directory is a git repository
if not exist ".git" (
    echo Error: Current directory is not a git repository.
    goto :error
)

:: Configure the remote repository with the token for authentication
echo Setting up remote repository...

:: Remove existing remote
git remote remove origin 2>nul

:: Add the remote with appropriate auth
set "remote_url=https://%github_token%@github.com/%github_username%/%repo_name%.git"
git remote add origin "%remote_url%"

if %errorlevel% neq 0 (
    echo Error: Failed to set up remote repository.
    goto :error
)

:: Display the status of changes
echo Current status:
git status

:: Prompt user to confirm update
set /p "confirm_update=Do you want to update these files on GitHub? (Y/N): "
if /i "%confirm_update%" neq "Y" goto :end

:: Stage all changes
echo Staging all changes...
git add .
if %errorlevel% neq 0 (
    echo Error: Failed to stage changes.
    goto :error
)

:: Commit changes
set /p "commit_message=Enter a commit message: "
if "%commit_message%"=="" set "commit_message=Update files"

echo Committing changes...
git commit -m "%commit_message%"
if %errorlevel% neq 0 (
    echo Error: Failed to commit changes.
    goto :error
)

:: Push changes
echo Pushing changes to GitHub...
git push -u origin HEAD
if %errorlevel% neq 0 (
    echo Error: Failed to push changes to GitHub.
    goto :error
)

echo Success! Changes have been pushed to GitHub.
goto :end

:error
echo An error occurred. Please check the output above for details.
echo Log file location: %log_file%
pause
exit /b 1

:end
echo Script completed at %date% %time% >> "%log_file%"
pause