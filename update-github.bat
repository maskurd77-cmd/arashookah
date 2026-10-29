@echo off
chcp 65001 >nul
title Aras Hookah Scale - Update GitHub
cd /d "%~dp0"
echo ========================================================
echo     Sending Aras Hookah Scale to GitHub (arashookah)
echo ========================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo [X] Git is not installed. Download it from https://git-scm.com and run this file again.
    pause
    exit /b 1
)

if not exist ".git" (
    echo First time: connecting this folder to GitHub...
    git init
    git remote add origin https://github.com/maskurd77-cmd/arashookah.git
    git fetch origin
    if errorlevel 1 (
        echo [X] Could not reach GitHub. Check the internet and that you are signed in.
        pause
        exit /b 1
    )
    git reset --soft origin/main
    git branch -M main
)

git add -A
git commit -m "Update: barcode scale, packet section, new cashier design, debts profit fix"
git push origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo   Done! GitHub is updated.
    echo ========================================================
) else (
    echo ========================================================
    echo   [X] Push failed. Sign in to GitHub when asked, then run this file again.
    echo ========================================================
)
echo.
pause
