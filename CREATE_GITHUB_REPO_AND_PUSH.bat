@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo HexForge Studio Pro - Create GitHub repository and push
echo ============================================================

where git >nul 2>nul || (
  echo ERROR: Git is not installed.
  echo Install it with: winget install --id Git.Git -e
  pause
  exit /b 1
)

where gh >nul 2>nul || (
  echo ERROR: GitHub CLI is not installed.
  echo Install it with: winget install --id GitHub.cli -e
  pause
  exit /b 1
)

for /f "delims=" %%L in ('gh api user --jq .login 2^>nul') do set "GH_LOGIN=%%L"
if /I not "%GH_LOGIN%"=="D3v4nshPat3l" (
  echo GitHub CLI is not authenticated as D3v4nshPat3l.
  echo Running GitHub login now...
  gh auth login || exit /b 1
)

for /f "delims=" %%L in ('gh api user --jq .login') do set "GH_LOGIN=%%L"
if /I not "%GH_LOGIN%"=="D3v4nshPat3l" (
  echo ERROR: Authenticated GitHub account is %GH_LOGIN%, not D3v4nshPat3l.
  pause
  exit /b 1
)

if not exist package.json (
  echo ERROR: package.json is missing from %CD%.
  pause
  exit /b 1
)

call npm ci --no-audit --no-fund || exit /b 1
call npm run typecheck || exit /b 1
call npm test || exit /b 1
call npm run build || exit /b 1

if not exist .git git init || exit /b 1
git branch -M main || exit /b 1
git add . || exit /b 1
git diff --cached --quiet || git commit -m "Initial release: HexForge Studio Pro 2.1.0" || exit /b 1

gh repo view D3v4nshPat3l/HexForge-Studio-Pro >nul 2>nul
if errorlevel 1 (
  gh repo create D3v4nshPat3l/HexForge-Studio-Pro --public --source=. --remote=origin --push || exit /b 1
) else (
  git remote get-url origin >nul 2>nul || git remote add origin https://github.com/D3v4nshPat3l/HexForge-Studio-Pro.git
  git push -u origin main || exit /b 1
)

echo.
echo SUCCESS: Project pushed to GitHub.
echo https://github.com/D3v4nshPat3l/HexForge-Studio-Pro
pause
