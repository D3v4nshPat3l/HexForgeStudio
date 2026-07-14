@echo off
setlocal
cd /d "%~dp0"

if not exist .git (
  echo ERROR: This folder is not a Git repository.
  echo Run CREATE_GITHUB_REPO_AND_PUSH.bat first.
  pause
  exit /b 1
)

set /p COMMIT_MESSAGE=Commit message: 
if "%COMMIT_MESSAGE%"=="" set "COMMIT_MESSAGE=Update HexForge Studio Pro"

git add . || exit /b 1
git diff --cached --quiet && (
  echo No changes to commit.
  pause
  exit /b 0
)
git commit -m "%COMMIT_MESSAGE%" || exit /b 1
git push || exit /b 1

echo Changes pushed successfully.
pause
