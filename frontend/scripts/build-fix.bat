@echo off
REM ============================================================
REM  Vishva ERP - quick rebuild after a fix (no clean)
REM
REM  This used to copy from outputs\productionRelease\ (a path that
REM  does not exist) and still print "BUILD OK" - the copy failure is
REM  now caught by build.bat's artifact check.
REM
REM  Same as: scripts\build.bat apk --no-clean
REM ============================================================
call "%~dp0build.bat" apk --no-clean
exit /b %ERRORLEVEL%
