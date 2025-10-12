param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$ReleaseNotes,
    
    [Parameter(Mandatory=$false)]
    [string]$GithubUrl
)

$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host "  Upload Update Manifest to Workers" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta
Write-Host ""

Set-Location $projectRoot

# Configuration
$CONFIG = @{
    WorkersUploadUrl = "https://permanent-link-service.zhangyuc2020.workers.dev/api/updater/upload"
    GithubRepo = "Zhangyuc2025/video-toolbox"
}

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "[ERROR] Invalid version format. Must be x.y.z" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Version: $Version" -ForegroundColor Cyan

# Find signature file
$bundlePath = "src-tauri\target\release\bundle\nsis"
$sigFile = Get-ChildItem "$bundlePath\*_${Version}_x64-setup.nsis.zip.sig" -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $sigFile) {
    Write-Host "[ERROR] Signature file not found: $bundlePath\*_${Version}_x64-setup.nsis.zip.sig" -ForegroundColor Red
    Write-Host "[INFO] Please run build script first" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Found signature file: $($sigFile.Name)" -ForegroundColor Green

# Read signature
$signature = Get-Content $sigFile.FullName -Raw -Encoding UTF8
Write-Host "[OK] Signature loaded" -ForegroundColor Green

# Get release notes
if (-not $ReleaseNotes) {
    Write-Host ""
    Write-Host "Enter release notes (one per line, empty line to finish):" -ForegroundColor Yellow
    $notes = @()
    while ($true) {
        $line = Read-Host
        if ([string]::IsNullOrWhiteSpace($line)) { break }
        $notes += "- $line"
    }
    $ReleaseNotes = $notes -join "`n"
}

if ([string]::IsNullOrWhiteSpace($ReleaseNotes)) {
    $ReleaseNotes = "Version $Version update"
}

Write-Host ""
Write-Host "[INFO] Release notes:" -ForegroundColor Cyan
Write-Host $ReleaseNotes

# Get GitHub URL
if (-not $GithubUrl) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "请从 GitHub Release 复制 .nsis.zip 文件的下载链接" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "示例: https://github.com/Zhangyuc2025/video-toolbox/releases/download/v1.0.1/xxx.zip" -ForegroundColor Gray
    Write-Host ""

    while ([string]::IsNullOrWhiteSpace($GithubUrl)) {
        $GithubUrl = Read-Host "请输入下载链接"
        if ([string]::IsNullOrWhiteSpace($GithubUrl)) {
            Write-Host "[ERROR] URL 不能为空，请重新输入" -ForegroundColor Red
        }
    }
}

Write-Host "[OK] GitHub URL: $GithubUrl" -ForegroundColor Green

# Generate update manifest
Write-Host ""
Write-Host "[INFO] Generating update manifest..." -ForegroundColor Cyan

$manifest = @{
    version = $Version
    notes = $ReleaseNotes
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature.Trim()
            url = $GithubUrl
        }
    }
} | ConvertTo-Json -Depth 10

# Save manifest locally
$manifestFile = "update-manifest.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines("$projectRoot\$manifestFile", @($manifest), $utf8NoBom)
Write-Host "[OK] Saved manifest to: $manifestFile" -ForegroundColor Green

# Upload to Cloudflare Workers
Write-Host ""
Write-Host "[INFO] Uploading to Cloudflare Workers..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $CONFIG.WorkersUploadUrl -Method Post -Body $manifest -ContentType "application/json"
    
    if ($response.success) {
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Magenta
        Write-Host "  Upload Successful!" -ForegroundColor Magenta
        Write-Host "==========================================" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "[OK] Version: $($response.version)" -ForegroundColor Green
        Write-Host "[OK] Update manifest is now live" -ForegroundColor Green
        Write-Host ""
        Write-Host "Users with version < $Version will receive update notification" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "[ERROR] Upload failed: $($response.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "[ERROR] Upload failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
