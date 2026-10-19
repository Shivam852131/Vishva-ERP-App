@echo off
REM Production release APK build
setlocal

set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Users\shiva\AppData\Local\Android\Sdk"
set ANDROID_PREFS_ROOT=
set "ANDROID_USER_HOME=C:\Users\shiva\.android"
set "PATH=%JAVA_HOME%\bin;%PATH%"

set "REAL=C:\Users\shiva\OneDrive\Desktop\vishva erp app\frontend"

subst Z: /D >nul 2>&1
subst Z: "%REAL%" || exit /b 1

set "VISHVA_JS_ROOT=%REAL%"
set "VISHVA_BUILD_DIR=%REAL%\android\app\build"
set "VISHVA_CODEGEN_DIR=Z:\node_modules\@react-native\codegen"
set "VISHVA_REACT_NATIVE_DIR=Z:\node_modules\react-native"
set "VISHVA_DISABLE_SOURCE_MAPS=true"

cd /d Z:\android
echo Building production release APK (v4.0.1 - versionCode 5)...
call Z:\android\gradlew.bat assembleProductionRelease --no-daemon
set GRADLE_EXIT=%ERRORLEVEL%

cd /d "%REAL%"
subst Z: /D >nul 2>&1

if %GRADLE_EXIT% neq 0 (
    echo BUILD FAILED - Gradle exit code %GRADLE_EXIT%
    exit /b %GRADLE_EXIT%
)

if exist "%REAL%\android\app\build\outputs\apk\production\release\app-production-release.apk" (
    copy /y "%REAL%\android\app\build\outputs\apk\production\release\app-production-release.apk" "%REAL%\app-release.apk"
) else if exist "%REAL%\android\app\build\outputs\apk\productionRelease\app-production-release.apk" (
    copy /y "%REAL%\android\app\build\outputs\apk\productionRelease\app-production-release.apk" "%REAL%\app-release.apk"
)

echo BUILD OK - app-release.apk (v4.0.1)
exit /b 0
