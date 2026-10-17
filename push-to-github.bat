@echo off
chcp 65001 >nul
title ناردنی پرۆژە بۆ گیت هاب (GitHub Push)
cd /d "%~dp0"
echo ========================================================
echo        ناردنی پرۆژەی Aras Hookah Shop بۆ گیت هاب
echo ========================================================
echo.
echo تکایە چاوەڕێبە... ئەگەر پەنجەرەی گیت هاب لە براوسەر کرایەوە Sign in بکە.
echo.

git remote set-url origin https://github.com/maskurd77-cmd/arashookah.git
git branch -M main
git push -u origin main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo  بە سەرکەوتوویی هەموو پرۆژەکە چووە ناو گیت هاب!
    echo ========================================================
) else (
    echo ========================================================
    echo  تکایە دڵنیابە لە ناو گیت هاب Sign in بوویت.
    echo ========================================================
)
echo.
pause
