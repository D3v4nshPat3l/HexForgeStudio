@echo off
REM HexForge Studio - Windows launcher
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.9+ is required but was not found on PATH.
  echo Download it from https://www.python.org/downloads/
  pause
  exit /b 1
)
python run.py %*
pause
