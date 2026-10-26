@echo off
REM ============================================================
REM  Vishva ERP - Play Store build (AAB), clean
REM
REM  Legacy name kept; logic lives in scripts\build.bat.
REM  Same as: scripts\build.bat aab
REM ============================================================
call "%~dp0build.bat" aab
exit /b %ERRORLEVEL%
