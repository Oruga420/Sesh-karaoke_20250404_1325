@echo off
setlocal enabledelayedexpansion

:: Start
echo 🚀 Starting GitHub repo upload...

:: Check if Git is installed
where git >nul 2>nul || (
    echo ❌ Git not found. Install Git and try again.
    exit /b 1
)

:: Check if curl is installed
where curl >nul 2>nul || (
    echo ❌ cURL not found. Install cURL and try again.
    exit /b 1
)

:: Prompt for GitHub username and token
set /p "github_username=👤 GitHub username: "
set /p "github_token=🔐 GitHub token: "

:: Validate token
echo 🔎 Validating GitHub token...
curl -s -H "Authorization: token %github_token%" https://api.github.com/user >nul
if errorlevel 1 (
    echo ❌ Invalid token or network error.
    exit /b 1
)

:: Get repo name: current folder + timestamp
for %%I in (.) do set "repo_name=%%~nxI"
set "timestamp=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%"
set "timestamp=%timestamp: =0%"
set "full_repo_name=%repo_name%_%timestamp%"
set "remote_url=https://github.com/%github_username%/%full_repo_name%.git"
echo 📁 Repo will be: %full_repo_name%

:: Create GitHub repo
curl -s -H "Authorization: token %github_token%" ^
     -H "Content-Type: application/json" ^
     -X POST ^
     -d "{\"name\":\"%full_repo_name%\"}" ^
     https://api.github.com/user/repos > repo_response.json

findstr /C:"\"full_name\": \"%github_username%/%full_repo_name%\"" repo_response.json >nul || (
    echo ❌ Failed to create repo or it already exists.
    type repo_response.json
    del repo_response.json
    exit /b 1
)
del repo_response.json
echo ✅ GitHub repo created!

:: Init repo (if not already)
if not exist ".git" (
    git init
    echo 🌀 Initialized empty Git repo.
)

:: Set up remote origin
git remote remove origin >nul 2>nul
git remote add origin %remote_url%
echo 🌐 Remote origin set to: %remote_url%

:: Add and commit files (respects .gitignore)
git add .
git status | findstr /C:"Changes to be committed" >nul
if %errorlevel% equ 0 (
    git commit -m "Initial commit"
    echo 📥 Files committed.
) else (
    echo ⚠️ Nothing to commit.
)

:: Push to GitHub
echo ☁️ Pushing to GitHub...
git branch -M main
git push -u origin main
if %errorlevel% neq 0 (
    echo ❌ Push failed.
    exit /b 1
)

:: Done!
echo ✅ All done! View your repo at:
echo 🔗 https://github.com/%github_username%/%full_repo_name%
pause
