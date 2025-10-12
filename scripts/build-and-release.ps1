param(
    [string]$NewVersion
)

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "  Tauri Build and Release Tool" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

Set-Location $projectRoot

# Step 1: Get current version
Write-Host "[INFO] Reading current version..." -ForegroundColor Cyan
$packageJson = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "[OK] Current version: $currentVersion" -ForegroundColor Green

# Step 2: Determine new version
if (-not $NewVersion) {
    Write-Host ""
    Write-Host "Select version upgrade:" -ForegroundColor Yellow

    $parts = $currentVersion.Split('.')
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]

    $patchVer = "$major.$minor.$($patch + 1)"
    $minorVer = "$major.$($minor + 1).0"
    $majorVer = "$($major + 1).0.0"

    Write-Host "  1. Patch: $currentVersion -> $patchVer"
    Write-Host "  2. Minor: $currentVersion -> $minorVer"
    Write-Host "  3. Major: $currentVersion -> $majorVer"
    Write-Host "  4. Custom version"
    Write-Host "  5. Keep current version (no change)"
    Write-Host "  0. Exit"
    Write-Host ""

    $choice = Read-Host "Your choice (0-5)"

    switch ($choice) {
        "1" { $NewVersion = $patchVer }
        "2" { $NewVersion = $minorVer }
        "3" { $NewVersion = $majorVer }
        "4" { $NewVersion = Read-Host "Enter version (e.g., 1.2.3)" }
        "5" { $NewVersion = $currentVersion }
        "0" { Write-Host "[INFO] Cancelled" -ForegroundColor Cyan; exit 0 }
        default { Write-Host "[ERROR] Invalid choice" -ForegroundColor Red; exit 1 }
    }
}

# Validate version format
if ($NewVersion -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "[ERROR] Invalid version format. Must be x.y.z" -ForegroundColor Red
    exit 1
}

# Step 3: Update version if changed
if ($NewVersion -ne $currentVersion) {
    Write-Host ""
    Write-Host "[INFO] Updating version to $NewVersion..." -ForegroundColor Cyan

    # Update package.json
    $packageJson.version = $NewVersion
    $jsonContent = $packageJson | ConvertTo-Json -Depth 100
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines("$projectRoot\package.json", @($jsonContent), $utf8NoBom)
    Write-Host "[OK] Updated package.json" -ForegroundColor Green

    # Update tauri.conf.json
    $tauriConf = Get-Content "src-tauri\tauri.conf.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $tauriConf.package.version = $NewVersion
    $jsonContent = $tauriConf | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllLines("$projectRoot\src-tauri\tauri.conf.json", @($jsonContent), $utf8NoBom)
    Write-Host "[OK] Updated tauri.conf.json" -ForegroundColor Green

    # Update Cargo.toml (only [package] section)
    $cargoToml = Get-Content "src-tauri\Cargo.toml" -Raw -Encoding UTF8
    $cargoToml = $cargoToml -replace '(\[package\][\s\S]*?version\s*=\s*)"[\d\.]+"', "`$1`"$NewVersion`""
    $cargoToml | Set-Content "src-tauri\Cargo.toml" -Encoding UTF8
    Write-Host "[OK] Updated Cargo.toml" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[INFO] Version unchanged: $NewVersion" -ForegroundColor Cyan
}

# Step 4: Build
Write-Host ""
Write-Host "[INFO] Starting build process..." -ForegroundColor Cyan
Write-Host "[WARN] This may take 2-5 minutes..." -ForegroundColor Yellow
Write-Host ""

# Check key file
$keyFile = "C:\Users\zhang\.tauri\videotoolbox.key"
if (-not (Test-Path $keyFile)) {
    Write-Host "[ERROR] Key file not found: $keyFile" -ForegroundColor Red
    exit 1
}

# Set environment variables
$env:TAURI_PRIVATE_KEY = Get-Content $keyFile -Raw -Encoding UTF8
$env:TAURI_KEY_PASSWORD = "zhang"

# Build
pnpm tauri:build

# Step 5: Check result
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "  Build Completed Successfully!" -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "[OK] Version: $NewVersion" -ForegroundColor Green
    Write-Host "[OK] Build files location:" -ForegroundColor Green
    Write-Host "     src-tauri\target\release\bundle\nsis" -ForegroundColor White
    Write-Host ""

    $openFolder = Read-Host "Open build folder? (y/n)"
    if ($openFolder -eq 'y' -or $openFolder -eq 'Y') {
        explorer "src-tauri\target\release\bundle\nsis"
    }

    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Create GitHub Release (tag: $NewVersion)"
    Write-Host "  2. Upload the 3 build files"
    Write-Host "  3. Test the installer"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Write-Host "[INFO] Please check the error messages above" -ForegroundColor Cyan
    exit 1
}
