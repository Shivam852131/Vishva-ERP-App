# cap.ps1 - Byte-safe Android screenshot capture for Vishva ERP marketing assets.
# Usage: .\cap.ps1 -Name "02-login-screen" [-SubDir "dashboards"] [-WaitMs 800]
# Captures the connected device/emulator screen via ADB (no app code is modified).
param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$SubDir = "",
    [int]$WaitMs = 800,
    [string]$OutRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutRoot) {
    $OutRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    if (-not $OutRoot) { $OutRoot = (Get-Location).Path }
}
# cap.ps1 lives in <assets>/tools -> parent is the assets root
$assetsRoot = Split-Path $PSScriptRoot -Parent

$adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
if (-not (Test-Path $adb)) { $adb = "adb" }

$targetDir = Join-Path $assetsRoot "screenshots"
if ($SubDir) { $targetDir = Join-Path $targetDir $SubDir }
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }

if ($WaitMs -gt 0) { Start-Sleep -Milliseconds $WaitMs }

$file = Join-Path $targetDir "$Name.png"
if (Test-Path $file) {
    Write-Output "SKIP_EXISTS: $file"
    exit 0
}

# cmd.exe redirection preserves raw bytes (PowerShell '>' would corrupt PNG data)
cmd /c "`"$adb`" exec-out screencap -p > `"$file`"" | Out-Null

if (Test-Path $file) {
    $bytes = [System.IO.File]::ReadAllBytes($file)[0..7]
    $hex = ($bytes | ForEach-Object { $_.ToString('X2') }) -join ' '
    $len = (Get-Item $file).Length
    if ($hex -eq "89 50 4E 47 0D 0A 1A 0A" -and $len -gt 10000) {
        Write-Output "OK: $file ($len bytes)"
    } else {
        Remove-Item $file -Force
        Write-Output "FAIL_CORRUPT: $Name"
        exit 1
    }
} else {
    Write-Output "FAIL_MISSING: $Name"
    exit 1
}
