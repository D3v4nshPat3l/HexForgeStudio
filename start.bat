@echo off
setlocal
cd /d "%~dp0"
title HexForge Studio Pro
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found.
  echo Install Node.js, close this window, and run START_HEXFORGE.bat again.
  echo.
  pause
  exit /b 1
)
call npm config set registry https://registry.npmjs.org/
if not exist node_modules (
  echo Installing HexForge Studio dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Installation failed. Review the error above.
    pause
    exit /b 1
  )
)
echo.
echo Starting HexForge Studio Pro...
echo The browser address is normally http://localhost:5173
call npm run dev
pause
