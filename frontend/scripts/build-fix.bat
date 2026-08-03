@echo off
setlocal

set "REAL=C:\Users\shiva\OneDrive\Desktop\vishva ERP app\frontend"
set "LOG=%REAL%\build-log.txt"

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

copy /y "%REAL%\android\app\build\outputs\apk\productionRelease\app-production-release.apk" "%REAL%\app-release.apk" >nul
echo BUILD OK - app-release.apk
exit /b 0
