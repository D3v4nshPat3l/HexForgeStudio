# Publishing HexForge Studio to the existing GitHub repository

This procedure replaces the repository's current working tree with the release archive while preserving the existing `main` history, stars, issues, settings, and a remote backup branch.

## What the repository audit found

- Existing repository: `D3v4nshPat3l/HexForge-Studio-Pro`
- Default branch: `main`
- Existing commits: 6
- Existing tags: none
- GitHub contributors API: only `D3v4nshPat3l` (6 contributions)
- Four historical commit messages contain AI co-author trailers

The requested AI co-author identity is not currently returned as a repository contributor. Removing the historical trailers would require rewriting those four commits, changing their SHAs, and force-pushing every affected branch/tag. That conflicts with the goal of preserving history and is unnecessary for the current contributors list.

## Prerequisites

Install Git and GitHub CLI, then authenticate once:

```bash
git --version
gh --version
gh auth login
gh auth status
```

Extract `HexForgeStudio-v4.0.0.zip` so this directory exists:

```text
C:\Users\devan\Downloads\HexForgeStudio\
```

## 1. Clone and create a recoverable backup

Run in Git Bash:

```bash
cd /c/Users/devan/Downloads
git clone https://github.com/D3v4nshPat3l/HexForge-Studio-Pro.git HexForgeStudio-repo
cd HexForgeStudio-repo
git switch main
git pull --ff-only origin main

BACKUP_BRANCH="backup/pre-v4-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
git push origin "$BACKUP_BRANCH"
```

The backup branch is a remote recovery point. Do not skip it.

## 2. Replace files without deleting repository history

```bash
git switch -c release/v4.0.0
git rm -r --ignore-unmatch .
cp -a /c/Users/devan/Downloads/HexForgeStudio/. .
git add -A
git status --short
git diff --cached --stat
```

Verify that `.git/` still exists and that `.venv/`, `node_modules/`, `__pycache__/`, and release ZIPs are not staged.

## 3. Validate before committing

```bash
npm ci
npm run typecheck
npm test
npm run build
python run.py --no-browser
```

After the local URL loads correctly, stop the launcher with `Ctrl+C`.

## 4. Commit real release work and merge

Use one honest release commit. Artificial commit inflation does not improve repository search ranking and makes history harder to review.

```bash
git add -A
git commit -m "release: publish HexForge Studio v4.0.0"
git push -u origin release/v4.0.0

git switch main
git merge --ff-only release/v4.0.0
git push origin main
```

If branch protection blocks the final push, open a pull request instead:

```bash
gh pr create --base main --head release/v4.0.0 --title "Release HexForge Studio v4.0.0" --body "Verified local-first v4 release with full documentation, execution screenshots, and passing tests."
```

## 5. Rename the existing repository

Rename only after `main` is updated:

```bash
gh repo rename HexForgeStudio --repo D3v4nshPat3l/HexForge-Studio-Pro --yes
git remote set-url origin https://github.com/D3v4nshPat3l/HexForgeStudio.git
git remote -v
```

GitHub redirects the old repository URL, but updating `origin` makes the new canonical name explicit.

## 6. Add description and discoverability topics

```bash
gh repo edit D3v4nshPat3l/HexForgeStudio \
  --description "Local-first hex editor, binary forensics, threat triage, PE analysis, and forensic PDF reporting." \
  --add-topic hex-editor \
  --add-topic digital-forensics \
  --add-topic binary-analysis \
  --add-topic malware-analysis \
  --add-topic reverse-engineering \
  --add-topic incident-response \
  --add-topic dfir \
  --add-topic pe-analysis \
  --add-topic file-signatures \
  --add-topic entropy-analysis \
  --add-topic threat-intelligence \
  --add-topic cybersecurity \
  --add-topic typescript \
  --add-topic vite \
  --add-topic local-first \
  --add-topic offline-first \
  --add-topic privacy \
  --add-topic web-worker
```

Topics should describe genuine capabilities. Do not add unrelated trending terms.

## 7. Create the first version tag and GitHub Release

From the updated `main` branch:

```bash
git tag -a v4.0.0 -m "HexForge Studio v4.0.0"
git push origin v4.0.0

gh release create v4.0.0 \
  /c/Users/devan/Downloads/HexForge-Studio/HexForgeStudio-v4.0.0.zip#HexForgeStudio-v4.0.0.zip \
  --repo D3v4nshPat3l/HexForgeStudio \
  --verify-tag \
  --title "HexForge Studio v4.0.0" \
  --generate-notes
```

## 8. Final verification

```bash
git status
git log --oneline --decorate -8
git tag --list
gh repo view D3v4nshPat3l/HexForgeStudio --web
gh release view v4.0.0 --repo D3v4nshPat3l/HexForgeStudio
```

Expected result: a clean working tree, preserved earlier commits, one new release commit, the `v4.0.0` tag, the ZIP attached to the release, the new canonical repository name, and relevant search topics.

## About contribution history

GitHub attributes commits from author/committer identity and recognized co-author trailers. The current contributors API already lists only `D3v4nshPat3l`. Do not create empty or backdated commits to manipulate the profile graph. Sustainable reach comes from accurate topics, a strong README, releases, useful issues, accepted pull requests, stars, forks, and genuine ongoing development.

## Command references

- [GitHub CLI: rename a repository](https://cli.github.com/manual/gh_repo_rename)
- [GitHub CLI: edit repository settings and topics](https://cli.github.com/manual/gh_repo_edit)
- [GitHub CLI: create a release and attach assets](https://cli.github.com/manual/gh_release_create)
