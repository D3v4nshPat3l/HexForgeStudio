# Architecture

## UI thread

`src/main.ts` owns tabs, sparse edits, cursor navigation, virtual rendering, reports, export, and UI state. It never places complete file contents in application state.

## Worker

`src/worker.ts` handles automatic analysis, search, and comparison away from the UI thread. The worker receives browser `File` objects and reads them in ranges.

## Analysis pipeline

`src/auto-analyzer.ts` performs identification first, then hashes, entropy, strings, and embedded signatures concurrently. Format-specific details and PE parsing are appended before returning one `FileAnalysis` object.

## Hex editor

The scroll range is normalized when a file would exceed practical browser scroll heights. Only visible rows plus a small buffer are rendered. Bytes are loaded with `Blob.slice()`, and sparse patches are overlaid on the result.

## Report

`src/report/pdf-report.ts` uses a page-aware writer. Each section checks available vertical space before adding content. Large string/signature lists are capped and the number of omitted results is reported.
