# Changelog

All notable project changes are documented here.

## [3.0.0] - 2026-08-06

### Added

- Threat Intelligence workspace: composite 0–100 score, six-band triage classification, weighted findings register, and score composition by category
- Capability tagging across 14 behaviour classes, from anti-debugging and sandbox evasion to credential access and destructive actions
- Indicator-of-compromise extraction for URLs, IP addresses, domains, emails, registry keys, filesystem paths, Base64 blobs, GUIDs, cryptocurrency wallets, living-off-the-land command lines, and user agents, with byte offsets preserved and CSV export
- Obfuscation and anti-analysis detection: single-byte XOR key recovery, packer and protector fingerprinting, cryptographic constant tables, position-independent code stubs, NOP/INT3 sleds, and entropy discontinuity mapping
- Embedded-executable detection for headers found beyond offset zero
- Full-file byte frequency histogram
- Forensic dossier PDF: cover page with risk gauge, executive summary, generated table of contents, vector charts (entropy profile, byte histogram, PE section map, category bars), findings register, capability and indicator appendices, hexadecimal excerpt, chain-of-custody block, classification banner, and per-page hash footers
- Expanded case metadata: evidence number, organization, acquisition method, and classification
- Dark forensic console theme with a light mode, persisted per browser
- Risk badge in the masthead that mirrors the current threat score

### Changed

- Complete visual redesign on a two-theme token system; all sizing derives from fluid scales so 1440p, 4K, and ultrawide displays gain density rather than empty space
- Entropy windowing now adapts to file size, targeting roughly 256 windows with a 4 KiB floor
- Analysis version raised to 3.0.0; `FileAnalysis` gains `byteHistogram`, `iocs`, `capabilities`, `obfuscation`, and `threat`

### Fixed

- Small files collapsed to a single entropy window, producing an unusable profile and suppressing every suspicious region
- Wide analysis tables widened the page instead of scrolling inside their own card at laptop widths

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
