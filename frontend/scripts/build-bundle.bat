@echo off
REM ============================================================
REM  Vishva ERP - AAB only, incremental (no clean)
REM
REM  Legacy name kept; logic lives in scripts\build.bat.
REM  Same as: scripts\build.bat aab --no-clean
REM ============================================================
call "%~dp0build.bat" aab --no-clean
exit /b %ERRORLEVEL%
