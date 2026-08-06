# Architecture

## UI thread

`src/main.ts` owns tabs, sparse edits, cursor navigation, virtual rendering, reports, export, and UI state. It never places complete file contents in application state.

## Worker

`src/worker.ts` handles automatic analysis, search, and comparison away from the UI thread. The worker receives browser `File` objects and reads them in ranges.

## Analysis pipeline

`src/auto-analyzer.ts` performs identification first, then hashes, entropy, the byte histogram, strings, and embedded signatures concurrently. Format-specific details and PE parsing are appended, and the security stage runs last because it consumes the earlier results.

The entropy window adapts to file size, targeting roughly 256 windows with a 4 KiB floor. The floor matters: Shannon entropy over `n` samples is bounded by `log2(n)`, so smaller windows could never reach the 7.35/7.75 suspicion thresholds and would silently suppress every region.

## Security stage

Four modules feed one `ThreatAssessment`:

- `src/analyzers/iocs.ts` — lexical indicator extraction over decoded strings. Character indices are scaled back to byte offsets (×2 for UTF-16) so every indicator remains clickable in the hex view.
- `src/analyzers/capabilities.ts` — matches string literals against a curated behaviour table. A hit proves the text exists, not that the API is imported or reachable.
- `src/analyzers/obfuscation.ts` — byte-level detection for single-byte XOR keys, packer markers, cryptographic constant tables, position-independent code stubs, and entropy discontinuities. Work is bounded by a probe budget rather than file size; when the file exceeds it, `scanLimited` is set and the UI and report both say so.
- `src/analyzers/threat.ts` — converts every signal into a weighted finding, sums per category, and caps each category so one noisy signal cannot dominate the 0–100 score.

## Theme

`src/theme.ts` resolves dark (the default), light, or a stored choice, and stamps `data-theme` on the root element. `src/styles.css` carries two complete token sets; all sizing derives from `--u` and the `--fs-*` ramp, which scale fluidly so 4K displays gain density rather than empty space.

## Hex editor

The scroll range is normalized when a file would exceed practical browser scroll heights. Only visible rows plus a small buffer are rendered. Bytes are loaded with `Blob.slice()`, and sparse patches are overlaid on the result.

## Report

`src/report/pdf-report.ts` builds a paginated forensic dossier through a page-aware `Dossier` writer. Every primitive reserves its height before drawing, so a row never straddles a page break, and tables repeat their header when they spill.

Page order is produced in three passes:

1. The cover and body are written, and each heading records the page it landed on.
2. The contents page is appended last — page numbers are only knowable then — and moved to position 2 with `movePage`. Body pages shift by one, which the contents printer accounts for.
3. Headers and footers are stamped over pages 2..N once the final count is known.

`src/report/charts.ts` draws the risk gauge, entropy profile, byte histogram, section map, and category bars using jsPDF path operations only. Nothing is rasterised, so charts stay sharp at any zoom and cost a few kilobytes each. The gauge approximates arcs with a triangle fan because jsPDF exposes no arc primitive.

`src/report.test.ts` parses the emitted text operators on the contents page and asserts each printed page number matches where that section actually renders, which is the part most likely to break silently.
