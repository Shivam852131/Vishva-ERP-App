@echo off
REM Production release APK build.
REM Gradle runs from Z: (subst) so native .cxx object paths stay under the 260-char
REM ninja limit, while Metro's JS root stays on the real path -- Metro realpath-resolves
REM its modules and fails to hash them when invoked from the substituted drive.

setlocal

set "REAL=C:\Users\shiva\OneDrive\Desktop\vishva ERP app\frontend"
set "LOG=%REAL%\build-log.txt"
set "VISHVA_JS_ROOT=%REAL%"
set "VISHVA_BUILD_DIR=%REAL%\android\app\build"
set "VISHVA_CODEGEN_DIR=Z:\node_modules\@react-native\codegen"
set "VISHVA_REACT_NATIVE_DIR=Z:\node_modules\react-native"
set "VISHVA_DISABLE_SOURCE_MAPS=true"

subst Z: /D >nul 2>&1
subst Z: "%REAL%" || exit /b 1

cd /d Z:\android
call Z:\android\gradlew.bat assembleProductionRelease --no-daemon > "%LOG%" 2>&1
set GRADLE_EXIT=%ERRORLEVEL%

cd /d "%REAL%"
subst Z: /D >nul 2>&1

if %GRADLE_EXIT% neq 0 (
    echo BUILD FAILED - see build-log.txt
    exit /b %GRADLE_EXIT%
)

copy /y "%VISHVA_BUILD_DIR%\outputs\apk\production\release\app-production-release.apk" "%REAL%\app-release.apk" >nul
echo BUILD OK - app-release.apk
exit /b 0
