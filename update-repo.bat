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
    echo Git not found >> "%log_file%"
    goto :error
)
echo Git found >> "%log_file%"

:: Get GitHub repository URL
set /p "repo_url=Enter your GitHub repository URL: "
echo GitHub repository URL (masked): ***repo-url*** >> "%log_file%"

:: Extract username and repo name from URL
for /f "tokens=4,5 delims=/" %%a in ("%repo_url%") do (
    set "github_username=%%a"
    set "repo_name=%%b"
)

:: Remove .git extension if present
set "repo_name=%repo_name:.git=%"

echo GitHub username: %github_username% >> "%log_file%"
echo Repository name: %repo_name% >> "%log_file%"

:: Get GitHub token
set /p "github_token=Enter your GitHub personal access token: "
echo GitHub token received (not logged for security reasons) >> "%log_file%"

:: Verify repository exists and is accessible
echo Verifying GitHub repository...
git ls-remote "%repo_url%" HEAD > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Repository not found or not accessible.
    echo Repository access failed >> "%log_file%"
    goto :error
)

echo Repository verified on GitHub >> "%log_file%"

:: Check if current directory is a git repository
if not exist ".git" (
    echo Error: Current directory is not a git repository.
    echo Current directory is not a git repository >> "%log_file%"
    goto :error
)

:: Configure the remote repository with the token for authentication
echo Setting up remote repository...
git remote remove origin 2>nul
git remote add origin "https://%github_token%@github.com/%github_username%/%repo_name%.git"
if %errorlevel% neq 0 (
    echo Error: Failed to set up remote repository.
    echo Failed to set up remote repository >> "%log_file%"
    goto :error
)
echo Remote repository set up successfully >> "%log_file%"

:: Display the status of changes
echo Current status:
git status
echo Current status logged >> "%log_file%"
git status >> "%log_file%"

:: Prompt user to confirm update
set /p "confirm_update=Do you want to update these files on GitHub? (Y/N): "
echo Update confirmation: %confirm_update% >> "%log_file%"
if /i "%confirm_update%" neq "Y" goto :end

:: Stage all changes
echo Staging all changes...
git add .
if %errorlevel% neq 0 (
    echo Error: Failed to stage changes.
    echo Failed to stage changes >> "%log_file%"
    goto :error
)
echo Staging successful >> "%log_file%"

:: Commit changes
set /p "commit_message=Enter a commit message: "
if "%commit_message%"=="" set "commit_message=Update files"
echo Commit message: %commit_message% >> "%log_file%"

echo Committing changes...
git commit -m "%commit_message%"
if %errorlevel% neq 0 (
    echo Error: Failed to commit changes.
    echo Failed to commit changes >> "%log_file%"
    goto :error
)
echo Commit successful >> "%log_file%"

:: Push changes
echo Pushing changes to GitHub...
git push -u origin HEAD
if %errorlevel% neq 0 (
    echo Error: Failed to push changes to GitHub.
    echo Failed to push changes >> "%log_file%"
    goto :error
)
echo Push successful >> "%log_file%"

echo Success! Changes have been pushed to GitHub.
echo Script completed successfully >> "%log_file%"
goto :end

:error
echo An error occurred. Please check the output above for details.
echo Error occurred. See log file for details: %log_file% >> "%log_file%"
echo Log file location: %log_file%
pause
exit /b 1

:end
echo Script completed at %date% %time% >> "%log_file%"
echo Log file location: %log_file%
pause