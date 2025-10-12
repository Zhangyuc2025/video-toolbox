@echo off
chcp 65001 >nul 2>&1

cls
echo.
echo ==============================================================
echo      Upload Update Manifest to Cloudflare Workers
echo ==============================================================
echo.

set /p VERSION="Enter version number (e.g., 1.0.1): "

if "%VERSION%"=="" (
    echo [ERROR] Version cannot be empty!
    pause
    exit /b 1
)

echo.
echo Version: %VERSION%
echo.

cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\upload-update-manifest.ps1" -Version "%VERSION%"

if errorlevel 1 (
    echo.
    echo [ERROR] Upload failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Upload completed!
pause
