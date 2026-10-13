@echo off
REM ============================================================
REM Vishva ERP v4.0 - AAB Build for Play Store
REM ============================================================
REM Usage: scripts\build-aab.bat
REM
REM This builds an Android App Bundle (.aab) for Google Play Store
REM submission. The AAB is more efficient than APK as it only
REM includes the resources needed for each device.
REM ============================================================

@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Vishva ERP v4.0 - Play Store Build (AAB)
echo ============================================================
echo.

cd /d "%~dp0..\android"

echo [1/3] Cleaning previous builds...
call gradlew.bat clean --no-daemon
if %ERRORLEVEL% neq 0 (
    echo ERROR: Clean failed!
    exit /b 1
)

echo.
echo [2/3] Building release AAB...
call gradlew.bat bundleProductionRelease --no-daemon
if %ERRORLEVEL% neq 0 (
    echo ERROR: AAB build failed!
    exit /b 1
)

echo.
echo [3/3] Build complete!
echo.
echo ============================================================
echo   Output File:
echo ============================================================
echo   AAB: android\app\build\outputs\bundle\productionRelease\
echo.
echo   Upload this .aab file to Google Play Console
echo ============================================================
echo.

dir /b "app\build\outputs\bundle\productionRelease\*.aab" 2>nul

echo.
echo Build finished successfully!
endlocal
