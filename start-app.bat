@echo off
title Aras Hookah Shop - Launcher
cd /d "%~dp0"
echo ========================================================
echo        Starting Aras Hookah Shop POS System...
echo ========================================================
echo.
echo Opening browser at http://localhost:5173/ ...
echo.

start "" "http://localhost:5173/"
cmd /c "npm run dev"
pause
