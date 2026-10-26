@echo off
REM ============================================================
REM  Vishva ERP - Full Release Build (APK + AAB)
REM
REM  Legacy name kept so existing habits keep working.
REM  All logic (JDK/SDK env, Z: mapping, clean, artifact checks)
REM  now lives in scripts\build.bat.
REM
REM  Usage: scripts\build-release.bat
REM  Same as: scripts\build.bat all        (clean + APK + AAB)
REM ============================================================
call "%~dp0build.bat" all
exit /b %ERRORLEVEL%
