@echo off
chcp 65001 >nul 2>&1

cls
echo.
echo ==============================================================
echo           Tauri Build and Release Tool
echo ==============================================================
echo.

cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\build-and-release.ps1"

if errorlevel 1 (
    echo.
    echo [ERROR] Script execution failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Script completed!
pause
