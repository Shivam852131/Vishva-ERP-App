@echo off
setlocal enabledelayedexpansion

REM ==========================================================================
REM  Vishva ERP - the one clean-build entry point (APK / AAB)
REM
REM  Usage:
REM    build.bat                 clean + APK + AAB      (default mode: all)
REM    build.bat apk             clean + APK only
REM    build.bat aab             clean + AAB only
REM    build.bat clean           clean only
REM    build.bat all --no-clean  incremental build, skip the clean (fast)
REM    build.bat apk --no-clean  same for a single artifact
REM
REM  Every legacy script (build-release.bat, build-apk-now.bat,
REM  build-all-fast.bat, build-all-now.bat, build-bundle.bat, build-aab.bat,
REM  build-fix.bat, build-apk.ps1) is a thin wrapper around this file, so the
REM  JDK/SDK environment, the Z: mapping Metro needs (see metro.config.js
REM  watchFolders), the Gradle tasks and the artifact checks live in exactly
REM  one place instead of seven.
REM
REM  Notes:
REM    * JS bundling is done by Gradle's own bundle task. Nothing pre-bakes a
REM      bundle into android\app\src\main\assets anymore - a stale copy there
REM      can shadow the fresh one.
REM    * Summary is appended to <frontend>\build-log.txt (git-ignored).
REM ==========================================================================

set "REAL=C:\Users\shiva\OneDrive\Desktop\vishva erp app\frontend"
set "MODE=all"
set "CLEAN=1"

REM ---- arguments -----------------------------------------------------------
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--no-clean" ( set "CLEAN=0" & shift & goto :parse_args )
if /i "%~1"=="--fast"     ( set "CLEAN=0" & shift & goto :parse_args )
if /i "%~1"=="apk"        ( set "MODE=apk" & shift & goto :parse_args )
if /i "%~1"=="aab"        ( set "MODE=aab" & shift & goto :parse_args )
if /i "%~1"=="all"        ( set "MODE=all" & shift & goto :parse_args )
if /i "%~1"=="clean"      ( set "MODE=clean" & shift & goto :parse_args )
echo.
echo ERROR: unknown argument "%~1"
echo        usage: build.bat [apk ^| aab ^| all ^| clean] [--no-clean]
exit /b 2
:args_done

REM ---- environment (single copy of what all the old scripts duplicated) ----
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Users\shiva\AppData\Local\Android\Sdk"
set ANDROID_PREFS_ROOT=
set "ANDROID_USER_HOME=C:\Users\shiva\.android"
set "PATH=%JAVA_HOME%\bin;%PATH%"

REM ---- VISHVA_* path pairing: two on Z:, two on the real drive -------------
REM
REM The React Native Gradle plugin builds every command line with
REM File.relativeTo(base), which on Windows throws
REM     this and base files have different roots
REM whenever the two paths are on different drives. It relativizes against
REM exactly two bases, and each variable below must match the root of the
REM base it is used against:
REM
REM   A: nodeWorkingDir = the module projectDir, always Z:\node_modules\...
REM      because settings.gradle autolinks from Z:\android. So the codegen
REM      pair must be on Z::
REM      - VISHVA_CODEGEN_DIR      generateCodegenSchemaFromJavaScript
REM      - VISHVA_REACT_NATIVE_DIR generateCodegenArtifactsFromSchema
REM      Pointing either at %REAL% makes that task die on "different roots".
REM
REM   B: root = react { root } = VISHVA_JS_ROOT, and buildDirectory =
REM      VISHVA_BUILD_DIR. BundleHermesCTask relativizes cliFile, entryFile,
REM      bundleFile, resourcesDir and the source maps against root, so both
REM      must stay on the real drive. Metro demands it as well: root on Z:
REM      while Node resolves metro's own modules to C: gives the file map a
REM      Z: root over C: paths, and it dies in TreeFS.getOrComputeSha1 with
REM        ENOENT ... Z:\C:\...\metro-runtime\src\polyfills\require.js
REM      which is the author's documented "Failed to get the SHA-1" failure.
REM
REM The two pairs would only meet at BundleHermesCTask line 111, which builds
REM composeScriptFile from reactNativeDir and relativizes it against root.
REM That line sits behind the guard at line 106,
REM   if (hermesFlags.get().contains("-output-source-map"))
REM and hermesFlags is forced to the single value -O by
REM VISHVA_DISABLE_SOURCE_MAPS below, so the guard is always false and the
REM line never runs. Do not turn that flag on - it would force all four
REM onto Z:, which Metro cannot survive.
REM
REM None of this is covered by a test: org.gradle.caching=true hides it,
REM because codegenDir and reactNativeDir are Internal and so not part of
REM the task cache key, letting a cache hit skip exec entirely. Only a
REM cache miss exposes the defect.
set "VISHVA_JS_ROOT=%REAL%"
set "VISHVA_BUILD_DIR=%REAL%\android\app\build"
set "VISHVA_CODEGEN_DIR=Z:\node_modules\@react-native\codegen"
set "VISHVA_REACT_NATIVE_DIR=Z:\node_modules\react-native"
set "VISHVA_DISABLE_SOURCE_MAPS=true"

REM ---- version, read from build.gradle instead of being hard-coded --------
set "VER_NAME=unknown"
set "VER_CODE=?"
for /f "tokens=2" %%V in ('findstr /c:"versionName " "%REAL%\android\app\build.gradle"') do set "VER_NAME=%%~V"
for /f "tokens=2" %%V in ('findstr /c:"versionCode " "%REAL%\android\app\build.gradle"') do set "VER_CODE=%%~V"

REM ---- task list -----------------------------------------------------------
set "TASKS="
if /i "%MODE%"=="clean" set "TASKS=clean"
if /i "%MODE%"=="apk"   set "TASKS=assembleProductionRelease"
if /i "%MODE%"=="aab"   set "TASKS=bundleProductionRelease"
if /i "%MODE%"=="all"   set "TASKS=assembleProductionRelease bundleProductionRelease"
if /i "%MODE%"=="clean" goto :tasks_done
if "%CLEAN%"=="1" set "TASKS=clean %TASKS%"
:tasks_done

echo.
echo ============================================================
echo   Vishva ERP - %MODE% build   v%VER_NAME%  versionCode %VER_CODE%
echo   clean=%CLEAN%   tasks: %TASKS%
echo ============================================================
echo.

REM ---- clean: drop the stale C++ staging cache first ------------------------
REM gradle's own native clean task (:app:externalNativeBuildClean*) re-runs
REM CMake *after* the library clean tasks have already deleted the codegen
REM dirs it points at (node_modules\*\android\build\generated\source\codegen),
REM so configure fails and the whole clean aborts before :app:clean ever runs.
REM Wiping the staging cache first is what that task was trying to do anyway,
REM and it leaves nothing stale for CMake to choke on.
if /i "%MODE%"=="clean" set "CLEAN=1"
if "%CLEAN%"=="0" goto :no_staging_wipe

set "STAGING="
for /f tokens^=2^ delims^=^" %%A in ('findstr /c:"buildStagingDirectory" "%REAL%\android\app\build.gradle"') do set "STAGING=%%A"
if not defined STAGING (
  echo [clean] note: could not read buildStagingDirectory from build.gradle
  goto :no_staging_wipe
)
set "STAGING=%STAGING:/=\%"
if exist "%STAGING%" (
  echo [clean] removing stale native build cache: %STAGING%
  rmdir /s /q "%STAGING%"
)
:no_staging_wipe

REM ---- Z: mapping (metro.config.js watches Z:\ - spaces in path break it) --
cd /d "%REAL%"
subst Z: /D >nul 2>&1
subst Z: "%REAL%"
if errorlevel 1 (
  echo ERROR: could not map Z: to "%REAL%"
  exit /b 1
)

cd /d Z:\android
if errorlevel 1 (
  cd /d "%REAL%"
  subst Z: /D >nul 2>&1
  echo ERROR: Z:\android not found
  exit /b 1
)

call Z:\android\gradlew.bat %TASKS% --no-daemon
set "GRADLE_EXIT=%ERRORLEVEL%"

cd /d "%REAL%"
subst Z: /D >nul 2>&1

if not "%GRADLE_EXIT%"=="0" (
  >>"%REAL%\build-log.txt" echo [%DATE% %TIME%] mode=%MODE% clean=%CLEAN% FAILED gradle=%GRADLE_EXIT%
  echo.
  echo ============================================================
  echo   BUILD FAILED - gradle exit code %GRADLE_EXIT%
  echo ============================================================
  endlocal & exit /b %GRADLE_EXIT%
)

REM ---- artifact verification: never claim success without the file --------
set "APK=%REAL%\android\app\build\outputs\apk\production\release\app-production-release.apk"
set "AAB=%REAL%\android\app\build\outputs\bundle\productionRelease\app-production-release.aab"
set "APK_OK=skipped"
set "AAB_OK=skipped"
set "EXIT_CODE=0"

if /i "%MODE%"=="clean" goto :log_summary

if not "%MODE%"=="aab" (
  if exist "%APK%" (
    copy /y "%APK%" "%REAL%\app-release.apk" >nul
    if errorlevel 1 (
      set "APK_OK=COPY-FAILED"
      set "EXIT_CODE=1"
      echo   APK  copy to app-release.apk FAILED
    ) else (
      set "APK_OK=ok"
      for %%A in ("%APK%") do echo   APK  %%~nxA   %%~zA bytes   %%~tA
    )
  ) else (
    set "APK_OK=MISSING"
    set "EXIT_CODE=1"
    echo   APK  MISSING: %APK%
  )
)

if not "%MODE%"=="apk" (
  if exist "%AAB%" (
    copy /y "%AAB%" "%REAL%\app-release.aab" >nul
    if errorlevel 1 (
      set "AAB_OK=COPY-FAILED"
      set "EXIT_CODE=1"
      echo   AAB  copy to app-release.aab FAILED
    ) else (
      set "AAB_OK=ok"
      for %%A in ("%AAB%") do echo   AAB  %%~nxA   %%~zA bytes   %%~tA
    )
  ) else (
    set "AAB_OK=MISSING"
    set "EXIT_CODE=1"
    echo   AAB  MISSING: %AAB%
  )
)

:log_summary
>>"%REAL%\build-log.txt" echo [%DATE% %TIME%] mode=%MODE% clean=%CLEAN% gradle=%GRADLE_EXIT% apk=%APK_OK% aab=%AAB_OK%

echo.
echo ============================================================
if "%EXIT_CODE%"=="0" (
  echo   BUILD SUCCESSFUL - v%VER_NAME%, mode %MODE%
) else (
  echo   BUILD INCOMPLETE - v%VER_NAME%, mode %MODE%
)
if not "%APK_OK%"=="skipped" echo   APK: %REAL%\app-release.apk  [%APK_OK%]
if not "%AAB_OK%"=="skipped" echo   AAB: %REAL%\app-release.aab  [%AAB_OK%]
echo   Log: %REAL%\build-log.txt
echo ============================================================
echo.

set "FINAL_EXIT=%EXIT_CODE%"
endlocal & exit /b %FINAL_EXIT%
