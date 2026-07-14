# Changelog

All notable project changes are documented here.

## [2.1.0] - 2026-07-14

### Added

- Continuous virtualized full-file hex scrolling
- Pinned offset and character columns
- High-visibility horizontal and vertical scrollbars
- Character rendering modes for Windows-1252, Latin-1, and ASCII
- Automatic file analysis, hashes, entropy, strings, signatures, PE parsing, comparison, source export, and PDF reports
- GitHub Actions for CI, CodeQL, and GitHub Pages
- GitHub issue templates, contribution policy, security policy, and repository metadata

### Fixed

- ASCII column clipping at common Windows display scaling levels
- Page-only file navigation that prevented continuous scrolling
- Large string extraction call-stack overflow
- PDF report pagination and automatic calculation flow
