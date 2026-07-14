# Publish HexForge Studio Pro to GitHub from Windows

Target repository:

```text
https://github.com/D3v4nshPat3l/HexForge-Studio-Pro
```

## Option A — GitHub CLI (recommended)

Install Git and GitHub CLI in Command Prompt or PowerShell:

```bat
winget install --id Git.Git -e
winget install --id GitHub.cli -e
```

Close and reopen Command Prompt, then verify:

```bat
git --version
gh --version
```

Authenticate with the correct account:

```bat
gh auth login
gh api user --jq .login
```

The final command must print:

```text
D3v4nshPat3l
```

Move into the project directory:

```bat
cd /d "D:\Hex Forge Studio"
```

Install and verify the project:

```bat
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
```

Create the public repository and push the project:

```bat
git init
git branch -M main
git add .
git commit -m "Initial release: HexForge Studio Pro 2.1.0"
gh repo create D3v4nshPat3l/HexForge-Studio-Pro --public --source=. --remote=origin --push
```

## Option B — Create the repository in the browser

1. Sign in to GitHub as `D3v4nshPat3l`.
2. Create a new public repository named `HexForge-Studio-Pro`.
3. Do not initialize it with a README, license, or `.gitignore` because those files are already included.
4. Run:

```bat
cd /d "D:\Hex Forge Studio"
git init
git branch -M main
git add .
git commit -m "Initial release: HexForge Studio Pro 2.1.0"
git remote add origin https://github.com/D3v4nshPat3l/HexForge-Studio-Pro.git
git push -u origin main
```

## Enable GitHub Pages

After pushing:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Open **Actions** and wait for `Deploy GitHub Pages` to finish.
5. The site will normally become available at:

```text
https://d3v4nshpat3l.github.io/HexForge-Studio-Pro/
```

## Future updates

```bat
cd /d "D:\Hex Forge Studio"
git add .
git commit -m "Describe your changes"
git push
```

## Common authentication problem

If Git pushes using the wrong account:

```bat
gh auth logout
gh auth login
gh api user --jq .login
```

Confirm that the login is `D3v4nshPat3l` before pushing.
