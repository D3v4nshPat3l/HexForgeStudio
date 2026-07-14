# Integration into the existing UI

This package deliberately contains no application styling. It is designed to replace the analysis logic while leaving the existing HTML and CSS unchanged.

## 1. Install and build

```bash
npm install
npm run build
```

## 2. Automatic analysis on upload

```ts
import { HexWorkerClient, savePdfReport } from "./src";

const input = document.querySelector<HTMLInputElement>("#fileInput");
if (!input) throw new Error("#fileInput was not found");

const worker = new HexWorkerClient();
let latestAnalysis = null;

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;

  latestAnalysis = await worker.analyze(file, {
    stringMinLength: 4,
    stringMaxResults: 10000,
    entropyWindowSize: 65536,
    signatureScanLimit: Math.min(file.size, 536870912)
  }, ({ stage, completed, total }) => {
    const percent = total ? Math.round(completed / total * 100) : 0;
    updateExistingProgressBar(stage, percent); // map this to the current UI
  });

  renderIntoExistingPanels(latestAnalysis); // keep current HTML/CSS
});

document.querySelector("#pdfReportButton")?.addEventListener("click", () => {
  if (!latestAnalysis) return;
  savePdfReport(latestAnalysis, {
    userNotes: document.querySelector<HTMLTextAreaElement>("#userNotes")?.value ?? ""
  });
});
```

No separate “Generate” button is required. Analysis starts from the file-input `change` event and emits progress continuously.

## 3. Fix for `Maximum call stack size exceeded`

Do not write either of these patterns for large data:

```js
String.fromCharCode(...largeUint8Array)
Math.max(...largeArray)
```

They pass every item as a function argument and overflow the JavaScript call stack. The included string extractor reads chunks, advances with loops, preserves strings across chunk boundaries, and caps result count.

## 4. Why the catalog alone detects less than HexEd.it

The supplied workbook is useful for extension/MIME labels, but it is not a magic-signature database. A production detector needs:

- byte patterns at exact and variable offsets;
- masks and wildcards;
- container inspection (ZIP/RIFF/EBML/ISO BMFF/OLE/CFB);
- structural validation and scoring;
- version and subtype rules;
- collision handling for ambiguous signatures;
- embedded-signature scanning;
- format-specific parsers.

The built-in detector covers common signatures and the requested families, but it does not claim 20,000-format parity. For that level, import a licensed signature database or an open PRONOM/DROID signature release and implement its offset/range semantics.

## 5. Large-file rules

- Never call `await file.arrayBuffer()` for the whole file.
- Read `file.slice(offset, offset + length)` pages.
- Render only visible rows in the hex grid.
- Keep analysis in a Web Worker.
- Transfer buffers rather than cloning where ownership permits.
- Cap report strings/signatures and paginate them.
- Keep the original file immutable and store edits as sparse patches.

## 6. Image preview limits

A hex editor can open every regular byte file. Browser-native image preview is different: TIFF, PSD, many RAW formats, JPEG 2000, and OpenEXR require dedicated decoders compiled to WebAssembly or JavaScript. Do not mark the file as unreadable merely because the browser cannot preview it.
