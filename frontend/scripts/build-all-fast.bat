@echo off
REM ============================================================
REM  Vishva ERP - APK + AAB, incremental (no clean)
REM
REM  Legacy name kept; logic lives in scripts\build.bat.
REM  Same as: scripts\build.bat all --no-clean
REM ============================================================
call "%~dp0build.bat" all --no-clean
exit /b %ERRORLEVEL%
