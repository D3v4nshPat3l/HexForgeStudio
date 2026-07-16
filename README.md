<div align="center">
  <img src="public/logo-mark.png" width="112" alt="HexForge Studio Pro logo">

# HexForge Studio Pro

**Local-first browser hex editing and forensic binary analysis.**

[![CI](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/ci.yml)
[![CodeQL](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/codeql.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/codeql.yml)
[![Deploy Pages](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/actions/workflows/deploy-pages.yml)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19-339933.svg?logo=node.js&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey.svg)](LICENSE)

[**Launch the application**](https://d3v4nshpat3l.github.io/HexForge-Studio-Pro/) · [Report a bug](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/D3v4nshPat3l/HexForge-Studio-Pro/issues/new?template=feature_request.yml)
</div>

> [!IMPORTANT]
> Files are processed locally in the browser for the core editing and analysis workflow. HexForge Studio Pro does not require a backend to open, inspect, modify, analyze, compare, or export files.

![Hex editor interface](docs/screenshots/hex-editor.png)

## Overview

HexForge Studio Pro is a browser-based binary workstation for developers, reverse engineers, security researchers, incident responders, and digital-forensics practitioners. It combines a virtualized hex editor with search, file identification, hashing, entropy analysis, string extraction, comparison, executable inspection, and structured PDF reporting.

The editor is designed around range-based file reads and sparse modifications rather than placing an entire file into application state. Analysis and search operations run in a Web Worker to keep the interface responsive during heavier workloads.

## Why HexForge Studio Pro?

| Capability | What it provides |
| --- | --- |
| **Local-first operation** | Core processing remains on the analyst's device and does not depend on an application server. |
| **Large-file-oriented editing** | Continuous virtualized scrolling renders visible rows with a small buffer instead of building a full-file DOM view. |
| **Forensic analysis workflow** | Identification, hashes, entropy, strings, embedded signatures, comparison, notes, and PDF reporting are available in one workspace. |
| **Non-destructive editing model** | Sparse patches are overlaid on range reads until the user explicitly saves or exports the modified bytes. |
| **Portable deployment** | The application can run through Vite locally or as a static GitHub Pages site. |

## Core capabilities

### Hex editing and workspace

- Continuous virtualized full-file hexadecimal and character views
- Pinned offset and character columns with high-visibility scrollbars
- Multiple workspace tabs and drag-and-drop file opening
- New-file creation, save, export, undo, and redo
- Overwrite, insert, delete, fill, invert, and randomize operations
- Byte selections, cursor navigation, and regional operations
- Character rendering modes for Windows-1252, Latin-1, and ASCII
- Bit editor, base converter, and source-code export

### Search and navigation

- Hexadecimal byte-pattern search
- Wildcard byte search
- Text and regular-expression search
- Signed and unsigned integer search
- Floating-point search
- Navigable results and difference ranges
- Stack-safe ASCII, UTF-8, UTF-16LE, and UTF-16BE string extraction

> [!NOTE]
> Regular-expression search is intentionally limited to 64 MiB because character-to-byte offset mapping becomes expensive at larger sizes. Byte and text searches remain the preferred options for large files.

### Automated analysis

- Conservative file-signature identification
- File-extension consistency checks
- Embedded-file signature scanning
- MD5, SHA-1, SHA-256, SHA-512, BLAKE3, and CRC-32 hashes
- Whole-file and selected-region entropy
- Suspicious high-entropy region detection
- PE/COFF structural analysis
- Browser-native image preview for decoder-supported formats
- Binary comparison with navigable difference ranges

### Reporting

- Structured, paginated PDF forensic reports
- Analyst notes and case context
- Hash, signature, entropy, string, and format-analysis sections
- Responsive report generation with intentionally capped large tables
- Explicit counts for omitted results when report sections are truncated

## Forensics lab

![Forensics lab](docs/screenshots/forensics-lab.png)

## PDF report

![PDF report](docs/screenshots/pdf-report.png)

## Format compatibility

Every regular file can be opened as bytes and used with the general-purpose hex viewing, editing, searching, hashing, entropy, string extraction, comparison, export, and reporting features.

Specialized identification or structural intelligence is available across a broad range of formats, including:

| Category | Examples |
| --- | --- |
| Images and camera RAW | PNG, JPEG, GIF, BMP, TIFF, ICO, PSD, SVG, JPEG 2000, OpenEXR, CR2, NEF, ARW, DNG, ORF, RW2, RAF, and CR3 |
| Archives and compression | TAR, ZIP and ZIP-derived containers, GZIP, BZIP2, XZ, 7-Zip, RAR, and CAB |
| Disk and virtual-disk images | ISO 9660, DMG, VHD, VHDX, and QCOW2 |
| Audio and video | WAV, FLAC, OGG, AAC, AIFF/AIFC, MIDI, AVI, MKV, WebM, MPEG, FLV, WMV/ASF, and MP3 |
| Executables and firmware | PE/COFF, ELF, Mach-O, Java Class, Android DEX, UEFI firmware volumes, EFI images, U-Boot images, and Linux x86 bzImage |
| Documents and structured data | PDF, PostScript/EPS, EPUB, CHM, DjVu, XML, HTML, JSON, CSV, ODS, ODP, and plain text |
| Encoded firmware records | Intel HEX and Motorola S-record |

See [Supported formats](SUPPORTED_FORMATS.md) for the detailed compatibility statement.

> [!CAUTION]
> Raw-byte compatibility does not imply complete decoding, decompression, filesystem parsing, or rendered preview. Proprietary, encrypted, damaged, vendor-specific, undocumented, or deliberately disguised files may require dedicated tooling.

## Architecture

```mermaid
flowchart LR
    A[Browser File object] --> B[Range-based reads]
    B --> C[Virtualized hex and character view]
    D[Sparse edit patches] --> C
    C --> E[Save or export modified bytes]

    A --> F[Web Worker]
    F --> G[Identification and extension checks]
    F --> H[Hashes and entropy]
    F --> I[Strings and embedded signatures]
    F --> J[Search and comparison]
    G --> K[Unified file analysis]
    H --> K
    I --> K
    J --> K
    K --> L[Forensics UI and PDF report]
```

The main UI thread owns tabs, cursor navigation, virtual rendering, sparse edits, report orchestration, and export state. The worker handles automatic analysis, search, and comparison away from the UI thread. See [Architecture](ARCHITECTURE.md) for implementation details.

## Requirements

- Node.js 20.19 or later; Node.js 22 LTS is recommended
- npm 10 or later
- A current version of Microsoft Edge, Google Chrome, Firefox, or another modern browser

## Quick start

```bash
git clone https://github.com/D3v4nshPat3l/HexForge-Studio-Pro.git
cd HexForge-Studio-Pro
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173`.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server on all local interfaces |
| `npm run typecheck` | Run TypeScript validation without emitting files |
| `npm test` | Run the Vitest test suite once |
| `npm run build` | Type-check and create the production bundle in `dist/` |
| `npm run preview` | Serve the production build locally for verification |

### Windows workspace example

```bat
cd /d "D:\Hex Forge Studio"
npm ci --no-audit --no-fund
npm run dev
```

See the [Windows installation guide](SETUP_GUIDE_WINDOWS.md) for a fuller setup walkthrough.

## Verification

Run the complete local verification sequence before publishing changes:

```bash
npm run typecheck
npm test
npm run build
```

The production output is written to `dist/`.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`.

1. Open the repository's **Settings → Pages** page.
2. Select **GitHub Actions** as the deployment source.
3. Push to `main`.
4. The workflow builds and publishes the static application.

Deployment URL:

```text
https://d3v4nshpat3l.github.io/HexForge-Studio-Pro/
```

## Recommended forensic workflow

1. Preserve the original evidence and work from a verified copy.
2. Calculate and record independent cryptographic hashes before analysis.
3. Open the working copy in HexForge Studio Pro and document relevant offsets, signatures, strings, and entropy regions.
4. Record analyst notes and export a PDF report for review.
5. Recalculate hashes for any exported or intentionally modified artifact.
6. Maintain chain-of-custody records outside the application according to your organization's procedures.

## Privacy, security, and evidentiary limitations

HexForge Studio Pro is an analysis aid, not a substitute for validated forensic tooling, malware sandboxing, specialist parsers, or expert review. Signature matches and suspicious-region indicators are evidence-based leads, not proof of file type, provenance, trustworthiness, or malicious behavior.

Browser-native preview depends on the active browser's decoders. Archive listing, decompression, disk-image filesystem parsing, proprietary RAW rendering, and architecture-specific firmware analysis require additional parsers and resource controls. Files designed to trigger decompression bombs, parser edge cases, or excessive resource consumption should be handled in an appropriately isolated environment.

Review the [known limitations](KNOWN_LIMITATIONS.md) and [security policy](SECURITY.md) before using the application in a production investigation.

## Documentation

| Document | Purpose |
| --- | --- |
| [Windows installation](SETUP_GUIDE_WINDOWS.md) | Set up and run the project on Windows |
| [GitHub publishing guide](GITHUB_SETUP_WINDOWS.md) | Publish and deploy the repository from Windows |
| [Architecture](ARCHITECTURE.md) | Understand the UI, worker, analysis, editor, and report design |
| [Integration notes](INTEGRATION.md) | Review component and integration guidance |
| [Supported formats](SUPPORTED_FORMATS.md) | See raw-byte and specialized format compatibility |
| [Known limitations](KNOWN_LIMITATIONS.md) | Understand intentional constraints and unsupported workflows |
| [Contributing](CONTRIBUTING.md) | Prepare changes and submit contributions |
| [Security policy](SECURITY.md) | Report vulnerabilities responsibly |
| [Changelog](CHANGELOG.md) | Review notable changes by release |

## Contributing

Contributions, defect reports, and focused feature proposals are welcome through GitHub. Before submitting a pull request:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) for repository conventions and submission expectations.

For security-sensitive findings, do not open a public issue. Follow the private reporting process described in [SECURITY.md](SECURITY.md).

## License

Copyright © 2026 Devansh Patel. All rights reserved.

This repository is not distributed under an open-source license. See [LICENSE](LICENSE) for the controlling terms.
