@echo off
chcp 65001 >nul
title Aras Hookah Shop - دەستپێکردنی سیستەم
cd /d "%~dp0"
echo ========================================================
echo        دەستپێکردنی سیستەمی فرۆشتنی Aras Hookah Shop
echo ========================================================
echo.
echo تکایە چاوەڕێبە تا سیستەمەکە لەسەر براوسەرەکەت دەکرێتەوە...
echo ناونیشان: http://localhost:5173/
echo.

start "" "http://localhost:5173/"
cmd /c "npm run dev"
pause
