@echo off
setlocal enabledelayedexpansion
title NetConfig Agent - Uninstaller

echo ============================================
echo    NetConfig Agent - Uninstaller
echo ============================================
echo.
echo This will:
echo   - Stop NetConfig Agent if it is running
echo   - Remove the Windows auto-start entry
echo   - Delete saved settings and tokens
echo   - Delete this application folder
echo.
set /p CONFIRM="Are you sure you want to uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo Stopping NetConfig Agent...
taskkill /F /IM "NetConfig Agent.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

echo Removing auto-start entry...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "NetConfigAgent" /f >nul 2>&1

echo Removing saved settings...
rd /s /q "%APPDATA%\netconfig-agent-gui" >nul 2>&1
rd /s /q "%APPDATA%\NetConfig Agent" >nul 2>&1

echo.
echo Done. This folder will now be removed.
pause

rem Self-delete trick: schedule removal of this folder from a copy running
rem out of %TEMP%, since Windows won't let a running folder delete itself.
set "TARGET=%~dp0"
set "HELPER=%TEMP%\NetConfigAgent-uninstall-helper-%RANDOM%.bat"

(
  echo @echo off
  echo timeout /t 1 /nobreak ^>nul
  echo rd /s /q "%TARGET%"
  echo del "%%~f0"
) > "%HELPER%"

start "" /min cmd /c "%HELPER%"
exit /b 0
