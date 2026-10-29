@echo off
chcp 65001 >nul
title Aras Hookah Scale - Launcher
cd /d "%~dp0"
echo ========================================================
echo        Starting Aras Hookah Scale POS System...
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js is not installed on this computer.
    echo     Download and install it from https://nodejs.org  ^(LTS^)
    echo     then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing packages for the first time, please wait ^(a few minutes^)...
    call npm install
    if errorlevel 1 (
        echo.
        echo [X] npm install failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
)

echo Opening browser at http://localhost:5173/ ...
start "" "http://localhost:5173/"
call npm run dev
echo.
echo The system stopped. If you saw an error above, send a screenshot.
pause
