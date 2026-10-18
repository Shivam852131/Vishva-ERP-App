@echo off
REM Production release APK build.
setlocal

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Users\shiva\AppData\Local\Android\Sdk"
set "ANDROID_PREFS_ROOT="
set "PATH=%JAVA_HOME%\bin;%PATH%"

set "REAL=C:\Users\shiva\OneDrive\Desktop\vishva erp app\frontend"
set "LOG=%REAL%\build-log.txt"
set "VISHVA_JS_ROOT=%REAL%"
set "VISHVA_BUILD_DIR=%REAL%\android\app\build"
set "VISHVA_CODEGEN_DIR=%REAL%\node_modules\@react-native\codegen"
set "VISHVA_REACT_NATIVE_DIR=%REAL%\node_modules\react-native"
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

if exist "%VISHVA_BUILD_DIR%\outputs\apk\production\release\app-production-release.apk" (
    copy /y "%VISHVA_BUILD_DIR%\outputs\apk\production\release\app-production-release.apk" "%REAL%\app-release.apk"
) else if exist "%VISHVA_BUILD_DIR%\outputs\apk\productionRelease\app-production-release.apk" (
    copy /y "%VISHVA_BUILD_DIR%\outputs\apk\productionRelease\app-production-release.apk" "%REAL%\app-release.apk"
)

echo BUILD OK - app-release.apk
exit /b 0
