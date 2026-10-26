@echo off
REM ============================================================
REM  Vishva ERP - Production release APK, incremental (no clean)
REM
REM  Legacy name kept; logic lives in scripts\build.bat.
REM  Same as: scripts\build.bat apk --no-clean
REM ============================================================
call "%~dp0build.bat" apk --no-clean
exit /b %ERRORLEVEL%
