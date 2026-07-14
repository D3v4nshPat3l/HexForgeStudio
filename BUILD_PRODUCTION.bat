@echo off
setlocal
cd /d "%~dp0"
call npm config set registry https://registry.npmjs.org/
if not exist node_modules call npm install --no-audit --no-fund
call npm run typecheck
if errorlevel 1 pause & exit /b 1
call npm test
if errorlevel 1 pause & exit /b 1
call npm run build
if errorlevel 1 pause & exit /b 1
echo.
echo Production build completed in: %CD%\dist
pause
