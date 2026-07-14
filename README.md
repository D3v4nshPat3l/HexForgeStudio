<div align="center">
  <img src="public/logo-mark.png" width="112" alt="HexForge Studio Pro logo">

# HexForge Studio Pro

**Local-first browser hex editing and forensic binary analysis.**

[![CI](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/ci.yml)
[![CodeQL](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/codeql.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/codeql.yml)
[![Deploy Pages](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/deploy-pages.yml)

[Live application](https://d3v4nshpat3l.github.io/HexForge-Studio-Pro/) · [Report a bug](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/issues/new?template=feature_request.yml)
</div>

> Files are analyzed locally in the browser. The application does not require a backend for its core editing and analysis features.

![Hex editor interface](docs/screenshots/hex-editor.png)

## Highlights

- Continuous virtualized full-file hexadecimal and character view
- Multiple workspace tabs, drag-and-drop opening, new files, save and export
- Overwrite, insert, delete, selection, fill, invert, randomize, undo and redo
- Advanced hexadecimal, wildcard, text, regex, integer and floating-point search
- Automatic file signatures, extension checks and embedded-file scanning
- MD5, SHA-1, SHA-256, SHA-512, BLAKE3 and CRC-32 hashes
- Stack-safe ASCII, UTF-8, UTF-16LE and UTF-16BE string extraction
- Whole-file and regional entropy with suspicious-region detection
- Binary file comparison and navigable difference ranges
- PE/COFF analysis and browser-native image preview
- Bit editor, base converter and source-code export
- Structured, paginated PDF forensic reports with analyst notes
- Local-only processing and Web Worker background analysis

## Screenshots

### Forensics lab

![Forensics lab](docs/screenshots/forensics-lab.png)

### PDF report

![PDF report](docs/screenshots/pdf-report.png)

## Requirements

- Node.js 20.19 or later; Node.js 22 LTS is recommended
- npm 10 or later
- Current Microsoft Edge, Google Chrome, Firefox, or another modern browser

## Local development

```bash
git clone https://github.com/D3v4nshPat3l/HexForge-Studio-Pro.git
cd HexForge-Studio-Pro
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`.

### Windows folder used by the project

```bat
cd /d "D:\Hex Forge Studio"
npm ci --no-audit --no-fund
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The production output is written to `dist/`.

## GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. In the repository, open **Settings → Pages** and select **GitHub Actions** as the deployment source. Each push to `main` will build and publish the application.

Expected site address:

```text
https://d3v4nshpat3l.github.io/HexForge-Studio-Pro/
```

## Repository documentation

- [Windows installation](SETUP_GUIDE_WINDOWS.md)
- [GitHub publishing guide](GITHUB_SETUP_WINDOWS.md)
- [Architecture](ARCHITECTURE.md)
- [Integration notes](INTEGRATION.md)
- [Supported formats](SUPPORTED_FORMATS.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Privacy and forensic limitations

HexForge Studio Pro is an analysis aid, not a substitute for validated forensic tooling or expert review. Signature matches and suspicious-region indicators are evidence-based hints, not absolute proof of a format or malicious behavior. Preserve original evidence, calculate independent hashes, and maintain proper chain-of-custody procedures for real investigations.

Large, encrypted, compressed, damaged, proprietary, or deliberately disguised files may require dedicated parsers. Browser-native image preview is limited to formats supported by the active browser.

## License

Copyright © 2026 Devansh Patel. All rights reserved. See [LICENSE](LICENSE).
