@echo off
REM ============================================================
REM Vishva ERP v4.0 - Release APK Build Script
REM ============================================================
REM Usage: scripts\build-release.bat
REM
REM Environment Variables (optional):
REM   VISHVA_STORE_FILE      - Path to release keystore
REM   VISHVA_STORE_PASSWORD  - Keystore password
REM   VISHVA_KEY_ALIAS       - Key alias
REM   VISHVA_KEY_PASSWORD    - Key password
REM   VISHVA_JS_ROOT         - JS root (for Windows long-path workaround)
REM   VISHVA_BUILD_DIR       - Build output dir (for Windows long-path workaround)
REM ============================================================

@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Vishva ERP v4.0 - Release Build
echo ============================================================
echo.

cd /d "%~dp0..\android"

echo [1/4] Cleaning previous builds...
call gradlew.bat clean --no-daemon
if %ERRORLEVEL% neq 0 (
    echo ERROR: Clean failed!
    exit /b 1
)

echo.
echo [2/4] Building release APK...
call gradlew.bat assembleProductionRelease --no-daemon
if %ERRORLEVEL% neq 0 (
    echo ERROR: APK build failed!
    exit /b 1
)

echo.
echo [3/4] Building release AAB (App Bundle)...
call gradlew.bat bundleProductionRelease --no-daemon
if %ERRORLEVEL% neq 0 (
    echo ERROR: AAB build failed!
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
echo ============================================================
echo   Output Files:
echo ============================================================
echo   APK: android\app\build\outputs\apk\productionRelease\
echo   AAB: android\app\build\outputs\bundle\productionRelease\
echo ============================================================
echo.

dir /b "app\build\outputs\apk\productionRelease\*.apk" 2>nul
dir /b "app\build\outputs\bundle\productionRelease\*.aab" 2>nul

echo.
echo Build finished successfully!
endlocal
