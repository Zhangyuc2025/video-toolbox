# PowerShell script to build BitBrowser API sidecar for Windows
# Usage: .\build_sidecar.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building BitBrowser API Sidecar" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if Python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check Python version
$pythonVersion = python --version
Write-Host "Using: $pythonVersion" -ForegroundColor Green

# Install/upgrade dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller

# Build the executable
Write-Host "`nBuilding executable with PyInstaller..." -ForegroundColor Yellow
pyinstaller bitbrowser_api.spec --clean

# Check if build succeeded
if (Test-Path "dist\bitbrowser-api.exe") {
    Write-Host "`nBuild successful!" -ForegroundColor Green
    Write-Host "Executable location: dist\bitbrowser-api.exe" -ForegroundColor Green

    # Get file size
    $fileSize = (Get-Item "dist\bitbrowser-api.exe").Length / 1MB
    Write-Host "File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan

    # Copy to Tauri binaries directory
    $targetDir = "..\src-tauri\binaries"
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir | Out-Null
    }

    Copy-Item "dist\bitbrowser-api.exe" "$targetDir\bitbrowser-api-x86_64-pc-windows-msvc.exe" -Force
    Write-Host "`nCopied to Tauri binaries: $targetDir\bitbrowser-api-x86_64-pc-windows-msvc.exe" -ForegroundColor Green

    # Test the executable
    Write-Host "`nTesting executable..." -ForegroundColor Yellow
    $testResult = & "dist\bitbrowser-api.exe" check 2>&1 | ConvertFrom-Json
    if ($testResult.success -eq $false) {
        Write-Host "Test result: Connection check - Expected (BitBrowser not running)" -ForegroundColor Yellow
    } else {
        Write-Host "Test result: Connection successful" -ForegroundColor Green
    }

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Build process completed!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host "`nBuild failed! Check errors above." -ForegroundColor Red
    exit 1
}
