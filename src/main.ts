import { BRAND_MARK } from "./brand";
import { renderByteForge } from "./ui/byte-forge";
import { hoverButtonLayers } from "./ui/forge-button";
import { FileByteSource } from "./byte-source";
import { HexWorkerClient } from "./worker-client";
import { buildPdfReport, savePdfReport } from "./report/pdf-report";
import { byteToBits, bitsToByte, setBit, toggleBit } from "./bit-editor";
import { convertBase } from "./base-converter";
import { exportAsSourceCode, type SourceLanguage } from "./export-source";
import { createNativeImagePreview, canBrowserDecodeImage, type PreviewHandle } from "./image-preview";
import { BUILTIN_SIGNATURES } from "./analyzers/signatures";
import { summarizeCapabilities } from "./analyzers/capabilities";
import { applyTheme, resolveInitialTheme, toggleTheme, type ThemeName } from "./theme";
import type { DifferenceRange, FileAnalysis, IocType, ProgressEvent, SearchQuery, SearchResult, Severity, ThreatFinding } from "./types";

type MainView = "hex" | "signature" | "intel" | "forensics" | "comparison" | "preview" | "report";
type InputMode = "hex" | "text";

interface PatchHistoryEntry {
  kind: "patch";
  label: string;
  changes: Array<{ offset: number; before: number | null; after: number | null }>;
}

interface FileHistoryEntry {
  kind: "file";
  label: string;
  before: File;
  after: File;
}

type HistoryEntry = PatchHistoryEntry | FileHistoryEntry;

interface EditorTab {
  id: string;
  file: File;
  source: FileByteSource;
  /**
   * Raw bytes around the last rendered window, before patches. Scrolling reuses this
   * so most frames render without awaiting a read, which is what removes the flicker.
   * Patches are layered on at render time because they change independently.
   */
  readCache?: { start: number; bytes: Uint8Array } | undefined;
  patches: Map<number, number>;
  cursor: number;
  nibble: 0 | 1;
  inputMode: InputMode;
  page: number;
  pageSize: number;
  selectionStart: number | null;
  selectionEnd: number | null;
  analysis?: FileAnalysis | undefined;
  progress?: ProgressEvent | undefined;
  error?: string | undefined;
  notes: string;
  analyst: string;
  caseId: string;
  organization: string;
  evidenceNumber: string;
  acquisitionMethod: string;
  classification: string;
  includeHexExcerpt: boolean;
  reportDetail: "summary" | "standard" | "full";
  iocFilter: IocType | "all";
  searchResults: SearchResult[];
  differences: DifferenceRange[];
  compareFile?: File | undefined;
  preview?: PreviewHandle | undefined;
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  hexScrollTop: number;
  hexScrollLeft: number;
}

const worker = new HexWorkerClient();
const tabs: EditorTab[] = [];
let activeId: string | null = null;
let activeView: MainView = "hex";
let bytesPerRow = 16;
let characterMode: "windows-1252" | "ascii" | "latin1" = "windows-1252";
let renderGeneration = 0;

/** Pending scroll render, so at most one runs per frame. */
let scrollFrame = 0;
let inspectorGeneration = 0;
let editQueue: Promise<void> = Promise.resolve();
let dragDepth = 0;
const MAX_SOURCE_EXPORT = 8 * 1024 * 1024;
const MAX_REPLACE_RESULTS = 25_000;
/**
 * Row height must agree with the `--row-h` custom property, because virtual row
 * positions are computed in JavaScript while the rows are sized by CSS. It was
 * previously hard-coded at 28px; once the type scale grew, every row was positioned
 * against a stale height and the grid drifted out of alignment as you scrolled.
 */
/** Collapses both side rails so the byte grid takes the full window width. */
let wideView = false;

let hexRowHeightCache = 0;
function hexRowHeight(): number {
  if (hexRowHeightCache > 0) return hexRowHeightCache;
  const probe = getComputedStyle(document.documentElement).getPropertyValue("--row-h").trim();
  const parsed = Number.parseFloat(probe);
  hexRowHeightCache = Number.isFinite(parsed) && parsed > 0 ? parsed : 32;
  return hexRowHeightCache;
}
window.addEventListener("resize", () => { hexRowHeightCache = 0; });
const MAX_HEX_SCROLL_HEIGHT = 30_000_000;
const HEX_OVERSCAN_ROWS = 64;

/**
 * Extra rows fetched on each side of the window. Generous on purpose: at 16 bytes per
 * row this is only ~13 KB per side, and it keeps roughly 24,000px of scrolling in
 * either direction served synchronously from memory. Every cache miss costs an await,
 * and an await during a scroll is what shows as blank rows.
 */
const HEX_CACHE_MARGIN_ROWS = 800;

// Assigned by mountWorkstation(). The workstation is loaded lazily from the router,
// so none of this may touch the DOM at import time.
let app!: HTMLDivElement;
let theme: ThemeName = resolveInitialTheme();

const logoSvg = BRAND_MARK;

const SHELL_HTML = `
<div class="studio-shell">
  <header class="brand-header">
    <div class="brand-lockup">
      <span class="brand-logo">${logoSvg}</span>
      <div>
        <h1>HexForge Studio</h1>
        <div class="active-file-heading"><strong id="activeFileHeading">No file loaded</strong><span id="activeFileSubheading">Open, drop, or create a binary file to begin</span></div>
      </div>
    </div>
    <div class="header-tools">
      <span id="riskBadgeSlot"></span>
      <a class="header-home" href="#/" title="Back to the overview">Overview</a>
      <button class="theme-toggle" data-action="toggle-theme" title="Switch between the dark and light console themes" aria-label="Switch theme">◐</button>
    </div>
  </header>

  <nav class="command-bar" aria-label="Application commands">
    <button data-command="new">${hoverButtonLayers("New", '', '＋')}</button>
    <button class="primary" data-command="open">${hoverButtonLayers("Open", '')}</button>
    <button data-command="import">${hoverButtonLayers("Import Data", '', '⇥')}</button>
    <span class="command-divider"></span>
    <button data-command="save" disabled>${hoverButtonLayers("Save", '', '▣')}</button>
    <button data-command="saveas" disabled>${hoverButtonLayers("Save As", '', '▤')}</button>
    <button data-command="export-selection" disabled>${hoverButtonLayers("Export Selection", '', '⇩')}</button>
    <span class="command-divider"></span>
    <button data-command="undo" disabled>${hoverButtonLayers("Undo", '', '↶')}</button>
    <button data-command="redo" disabled>${hoverButtonLayers("Redo", '', '↷')}</button>
    <span class="command-divider"></span>
    <button data-command="find" disabled>${hoverButtonLayers("Find", '', '⌕')}</button>
    <button data-command="replace" disabled>${hoverButtonLayers("Replace", '', '⟳')}</button>
    <button data-command="goto" disabled>${hoverButtonLayers("Go To", '', '#')}</button>
    <span class="command-divider"></span>
    <button data-command="insert" disabled>${hoverButtonLayers("Insert", '', '⊕')}</button>
    <button data-command="delete" disabled>${hoverButtonLayers("Delete", '', '⌫')}</button>
    <span class="command-spacer"></span>
    <div class="view-tabs" id="viewTabs" role="tablist" aria-label="Workspace views">
      <button class="view-tab active" data-view="hex">${hoverButtonLayers("Hex Editor")}</button>
      <button class="view-tab" data-view="signature">${hoverButtonLayers("Signature Analysis")}</button>
      <button class="view-tab" data-view="intel">${hoverButtonLayers("Threat Intelligence", '<span class="tab-count" id="intelTabCount">0</span>')}</button>
      <button class="view-tab" data-view="forensics">${hoverButtonLayers("Forensics Lab")}</button>
      <button class="view-tab" data-view="comparison">${hoverButtonLayers("File Comparison")}</button>
      <button class="view-tab" data-view="preview">${hoverButtonLayers("PE / Preview")}</button>
      <button class="view-tab" data-view="report">${hoverButtonLayers("PDF Report")}</button>
    </div>
  </nav>

  <div class="workspace-tabs" id="workspaceTabs"><span>Open multiple files to create workspace tabs.</span></div>

  <main class="app-workspace">
    <aside class="left-rail">
      <div class="rail-scroll">
        <h2>FILE NAVIGATOR</h2>
        <section class="rail-section">
          <h3>FILE INFORMATION</h3>
          <dl id="fileInformation">
            <div><dt>Name</dt><dd>—</dd></div><div><dt>Size</dt><dd class="mono">0 bytes</dd></div><div><dt>Modified</dt><dd>—</dd></div><div><dt>Type</dt><dd>—</dd></div>
          </dl>
        </section>
        <section class="rail-section">
          <h3>SCROLL / JUMP NAVIGATION</h3>
          <label class="stack-label">Bytes per page<select id="pageSizeSelect"><option value="256">256</option><option value="1024" selected>1,024</option><option value="4096">4,096</option><option value="16384">16,384</option></select></label>
          <div class="two-buttons"><button data-action="previous-page" disabled>Previous</button><button data-action="next-page" disabled>Next</button></div>
          <p class="page-count" id="pageCount">Page 0 of 0</p>
        </section>
        <section class="rail-section">
          <h3>QUICK ACTIONS</h3>
          <button class="wide subtle" data-action="copy-hex" disabled>Copy selection as hex</button>
          <button class="wide subtle" data-action="copy-text" disabled>Copy selection as text</button>
          <button class="wide subtle" data-action="save-selection" disabled>Save selection to file</button>
          <button class="wide subtle" data-action="select-all" disabled>Select entire file</button>
        </section>
        <section class="rail-section">
          <h3>WORKSPACE FILES</h3>
          <div id="fileNavigatorList" class="file-navigator-list"><p>No files open.</p></div>
        </section>
      </div>
    </aside>

    <section class="center-workspace">
      <div class="view-content" id="viewContent"></div>
    </section>

    <aside class="right-rail">
      <div class="rail-scroll">
        <h2>BYTE EDITOR</h2>
        <section class="rail-section" id="byteForge"><p class="rail-empty">Select a byte in the editor.</p></section>
        <section class="rail-section compact-section">
          <h3>SELECTION</h3>
          <dl id="selectionInfo"><div><dt>Start</dt><dd>—</dd></div><div><dt>End</dt><dd>—</dd></div><div><dt>Length</dt><dd class="mono">0</dd></div></dl>
        </section>
        <section class="rail-section">
          <h3>EDIT OPERATIONS</h3>
          <div class="two-buttons"><button data-action="fill-00" disabled>Fill 00</button><button data-action="fill-ff" disabled>Fill FF</button></div>
          <div class="two-buttons"><button data-action="invert" disabled>Invert</button><button data-action="random" disabled>Random</button></div>
        </section>
        <section class="rail-section">
          <h3>DATA INSPECTOR</h3>
          <div id="dataInspector" class="data-inspector"><p>No byte selected.</p></div>
        </section>
        <section class="rail-section">
          <h3>KEYBOARD SHORTCUTS</h3>
          <ul class="shortcut-list">
            <li><span>Open</span><kbd>Ctrl O</kbd></li><li><span>Save</span><kbd>Ctrl S</kbd></li><li><span>Find / Replace</span><kbd>Ctrl F / H</kbd></li><li><span>Go to offset</span><kbd>Ctrl G</kbd></li><li><span>Undo / Redo</span><kbd>Ctrl Z / Y</kbd></li><li><span>Select all</span><kbd>Ctrl A</kbd></li>
          </ul>
        </section>
      </div>
    </aside>
  </main>

  <footer class="global-status" id="globalStatus"><span>Offset: — &nbsp;&nbsp; Selection: 0 bytes &nbsp;&nbsp; Size: 0 bytes</span><span>HEX / Windows-1252</span><span>Ready</span></footer>
  <input id="fileInput" type="file" multiple hidden />
  <input id="compareInput" type="file" hidden />
  <div class="drop-overlay" id="dropOverlay"><div>${logoSvg}<strong>Drop files to open in HexForge Studio</strong><span>Files never leave this browser.</span></div></div>
  <div class="modal-backdrop hidden" id="modalBackdrop"><div class="modal" id="modal"></div></div>
  <div class="toast-region" id="toastRegion" aria-live="polite"></div>
</div>`;

const $ = <T extends Element>(selector: string): T => {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing element: ${selector}`);
  return value;
};

let viewContent!: HTMLDivElement;
let workspaceTabs!: HTMLDivElement;
let fileInput!: HTMLInputElement;
let compareInput!: HTMLInputElement;
let pageSizeSelect!: HTMLSelectElement;
let modalBackdrop!: HTMLDivElement;
let modal!: HTMLDivElement;

function activeTab(): EditorTab | undefined {
  return tabs.find((tab) => tab.id === activeId);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value.toLocaleString()} bytes`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[index] ?? "KiB"}`;
}

function formatOffset(offset: number): string {
  return `0x${Math.max(0, Math.floor(offset)).toString(16).toUpperCase().padStart(8, "0")}`;
}

function parseOffset(value: string): number {
  const clean = value.trim().replaceAll("_", "");
  if (/^0x[0-9a-f]+$/i.test(clean)) return Number.parseInt(clean.slice(2), 16);
  if (/^[0-9]+$/.test(clean)) return Number.parseInt(clean, 10);
  throw new Error("Enter a decimal offset or a hexadecimal value beginning with 0x.");
}

function parseHexBytes(value: string): Uint8Array {
  const clean = value.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (!clean || clean.length % 2 !== 0) throw new Error("Enter an even number of hexadecimal digits.");
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function toast(message: string, tone: "info" | "success" | "error" = "info"): void {
  const item = document.createElement("div");
  item.className = `toast ${tone}`;
  item.textContent = message;
  $("#toastRegion").append(item);
  window.setTimeout(() => item.remove(), 4600);
}

function showModal(title: string, body: string): void {
  modal.innerHTML = `<div class="modal-title"><h2>${escapeHtml(title)}</h2><button data-modal-close aria-label="Close">×</button></div>${body}`;
  modalBackdrop.classList.remove("hidden");
  window.setTimeout(() => modal.querySelector<HTMLInputElement>("input,textarea,select")?.focus(), 0);
}

function closeModal(): void {
  modalBackdrop.classList.add("hidden");
  modal.innerHTML = "";
}

function selectionBounds(tab: EditorTab): { start: number; end: number; length: number } | null {
  if (tab.selectionStart === null || tab.selectionEnd === null || tab.file.size === 0) return null;
  const start = Math.max(0, Math.min(tab.selectionStart, tab.selectionEnd));
  const end = Math.min(tab.file.size - 1, Math.max(tab.selectionStart, tab.selectionEnd));
  return { start, end, length: end - start + 1 };
}

function currentEffectiveFile(tab: EditorTab): File {
  if (tab.patches.size === 0) return tab.file;
  return new File([patchedBlob(tab)], tab.file.name, { type: tab.file.type, lastModified: tab.file.lastModified });
}

async function readRange(tab: EditorTab, offset: number, length: number): Promise<Uint8Array> {
  const bytes = await tab.source.read(offset, Math.max(0, Math.min(length, tab.file.size - offset)));
  for (const [patchOffset, value] of tab.patches) {
    if (patchOffset >= offset && patchOffset < offset + bytes.length) bytes[patchOffset - offset] = value;
  }
  return bytes;
}

async function readByte(tab: EditorTab, offset: number): Promise<number> {
  const patch = tab.patches.get(offset);
  if (patch !== undefined) return patch;
  return (await tab.source.read(offset, 1))[0] ?? 0;
}

function recordPatch(tab: EditorTab, label: string, changes: Array<{ offset: number; before: number | null; after: number | null }>): void {
  if (changes.length === 0) return;
  tab.undo.push({ kind: "patch", label, changes });
  if (tab.undo.length > 250) tab.undo.shift();
  tab.redo = [];
}

function applyPatchChanges(tab: EditorTab, changes: Array<{ offset: number; before: number | null; after: number | null }>, direction: "forward" | "backward"): void {
  for (const change of changes) {
    const value = direction === "forward" ? change.after : change.before;
    if (value === null) tab.patches.delete(change.offset);
    else tab.patches.set(change.offset, value & 0xFF);
  }
}

function setBytes(tab: EditorTab, start: number, values: Uint8Array, label: string): void {
  const changes: Array<{ offset: number; before: number | null; after: number | null }> = [];
  for (let index = 0; index < values.length; index += 1) {
    const offset = start + index;
    if (offset < 0 || offset >= tab.file.size) break;
    const before = tab.patches.get(offset) ?? null;
    const after = values[index] ?? 0;
    tab.patches.set(offset, after);
    changes.push({ offset, before, after });
  }
  recordPatch(tab, label, changes);
  updateAll();
}

function replaceTabFile(tab: EditorTab, after: File, label: string, record = true): void {
  const before = currentEffectiveFile(tab);
  tab.preview?.revoke();
  tab.preview = undefined;
  tab.file = after;
  tab.source = new FileByteSource(after);
  invalidateReadCache(tab);
  tab.patches.clear();
  tab.cursor = Math.min(tab.cursor, Math.max(0, after.size - 1));
  tab.selectionStart = after.size ? tab.cursor : null;
  tab.selectionEnd = after.size ? tab.cursor : null;
  tab.page = Math.floor(tab.cursor / tab.pageSize);
  tab.hexScrollTop = 0;
  tab.hexScrollLeft = 0;
  tab.analysis = undefined;
  tab.searchResults = [];
  tab.differences = [];
  if (record) {
    tab.undo.push({ kind: "file", label, before, after });
    tab.redo = [];
  }
  void analyze(tab);
  updateAll();
}

function undo(): void {
  const tab = activeTab();
  const entry = tab?.undo.pop();
  if (!tab || !entry) return;
  if (entry.kind === "patch") applyPatchChanges(tab, entry.changes, "backward");
  else {
    tab.preview?.revoke();
    tab.file = entry.before;
    tab.source = new FileByteSource(entry.before);
    tab.patches.clear();
    tab.analysis = undefined;
    void analyze(tab);
  }
  tab.redo.push(entry);
  updateAll();
  toast(`Undid ${entry.label}.`, "success");
}

function redo(): void {
  const tab = activeTab();
  const entry = tab?.redo.pop();
  if (!tab || !entry) return;
  if (entry.kind === "patch") applyPatchChanges(tab, entry.changes, "forward");
  else {
    tab.preview?.revoke();
    tab.file = entry.after;
    tab.source = new FileByteSource(entry.after);
    tab.patches.clear();
    tab.analysis = undefined;
    void analyze(tab);
  }
  tab.undo.push(entry);
  updateAll();
  toast(`Redid ${entry.label}.`, "success");
}

function createTab(file: File): EditorTab {
  return {
    id: crypto.randomUUID(), file, source: new FileByteSource(file), patches: new Map(), cursor: 0, nibble: 0, inputMode: "hex",
    page: 0, pageSize: 1024, selectionStart: file.size ? 0 : null, selectionEnd: file.size ? 0 : null,
    notes: "", analyst: "", caseId: "", organization: "", evidenceNumber: "", acquisitionMethod: "", classification: "",
    includeHexExcerpt: true, reportDetail: "standard", iocFilter: "all",
    searchResults: [], differences: [], undo: [], redo: [],
    hexScrollTop: 0, hexScrollLeft: 0
  };
}

function openFiles(files: File[]): void {
  for (const file of files) {
    const tab = createTab(file);
    tabs.push(tab);
    activeId = tab.id;
    void analyze(tab);
  }
  activeView = "hex";
  updateAll();
}

function closeTab(id: string): void {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;
  tabs[index]?.preview?.revoke();
  tabs.splice(index, 1);
  if (activeId === id) activeId = tabs[Math.max(0, index - 1)]?.id ?? tabs[0]?.id ?? null;
  updateAll();
}

function activateTab(id: string): void {
  activeId = id;
  updateAll();
}

async function analyze(tab: EditorTab): Promise<void> {
  tab.error = undefined;
  tab.progress = { stage: "Preparing analysis", completed: 0, total: 1 };
  if (tab.id === activeId) updateAll();
  try {
    const effective = currentEffectiveFile(tab);
    tab.analysis = await worker.analyze(effective, {
      chunkSize: 4 * 1024 * 1024,
      stringMinLength: 4,
      stringMaxResults: 30_000,
      entropyWindowSize: 64 * 1024,
      entropyStep: 64 * 1024,
      signatureScanLimit: Math.min(effective.size, 1024 * 1024 * 1024)
    }, (progress) => {
      tab.progress = progress;
      if (tab.id === activeId) updateStatusOnly();
    });
    tab.progress = undefined;
    if (tab.id === activeId) updateAll();
    toast(`Automatic analysis completed for ${tab.file.name}.`, "success");
  } catch (error) {
    tab.progress = undefined;
    tab.error = error instanceof Error ? error.message : String(error);
    if (tab.id === activeId) updateAll();
    toast(`Analysis failed: ${tab.error}`, "error");
  }
}

function patchedBlob(tab: EditorTab): Blob {
  if (tab.patches.size === 0) return tab.file;
  const sorted = [...tab.patches.entries()].sort((left, right) => left[0] - right[0]);
  const parts: BlobPart[] = [];
  let cursor = 0;
  let index = 0;
  while (index < sorted.length) {
    const first = sorted[index];
    if (!first) break;
    const start = first[0];
    if (start > cursor) parts.push(tab.file.slice(cursor, start));
    const values: number[] = [];
    let expected = start;
    while (index < sorted.length) {
      const item = sorted[index];
      if (!item || item[0] !== expected) break;
      values.push(item[1]);
      expected += 1;
      index += 1;
    }
    parts.push(new Uint8Array(values));
    cursor = expected;
  }
  if (cursor < tab.file.size) parts.push(tab.file.slice(cursor));
  return new Blob(parts, { type: tab.file.type || "application/octet-stream" });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function saveCurrent(saveAs = false): void {
  const tab = activeTab();
  if (!tab) return;
  let name = tab.file.name || "untitled.bin";
  if (saveAs) {
    const entered = window.prompt("Save file as:", name);
    if (!entered) return;
    name = entered;
  }
  downloadBlob(patchedBlob(tab), name);
  toast(`${name} exported.`, "success");
}

function setCursor(offset: number, extendSelection = false, reveal = true): void {
  const tab = activeTab();
  if (!tab || tab.file.size === 0) return;
  const next = Math.max(0, Math.min(tab.file.size - 1, Math.floor(offset)));
  if (extendSelection && tab.selectionStart !== null) tab.selectionEnd = next;
  else { tab.selectionStart = next; tab.selectionEnd = next; }
  tab.cursor = next;
  tab.nibble = 0;
  tab.page = Math.floor(next / tab.pageSize);
  if (reveal) {
    const totalRows = Math.max(1, Math.ceil(tab.file.size / bytesPerRow));
    const height = virtualHexHeight(totalRows);
    const row = Math.floor(next / bytesPerRow);
    const rowTop = hexRowToTop(row, totalRows, height);
    const rowHeight = hexRowHeight();

    // Only scroll when the cursor would actually leave the viewport. Unconditionally
    // recentering meant every keystroke nudged the grid under the user while they were
    // typing, even though the byte they were editing was already on screen.
    const grid = document.querySelector<HTMLElement>("#hexGrid");
    const viewportHeight = grid?.clientHeight ?? 0;
    const margin = rowHeight * 2;
    const visibleTop = tab.hexScrollTop;
    const visibleBottom = visibleTop + viewportHeight;

    if (viewportHeight === 0) {
      tab.hexScrollTop = Math.max(0, rowTop - rowHeight * 4);
    } else if (rowTop < visibleTop + margin) {
      tab.hexScrollTop = Math.max(0, rowTop - margin);
    } else if (rowTop + rowHeight > visibleBottom - margin) {
      tab.hexScrollTop = Math.max(0, rowTop + rowHeight - viewportHeight + margin);
    }
  }
  updateAll();
  window.setTimeout(() => document.querySelector<HTMLElement>("#hexGrid")?.focus({ preventScroll: true }), 0);
}

function updateAll(): void {
  document.querySelector(".studio-shell")?.classList.toggle("wide-view", wideView);
  void refreshForgePanel(activeTab() ?? null);
  renderWorkspaceTabs();
  renderFileNavigator();
  renderSidebars();
  updateCommands();
  renderViewTabs();
  renderActiveView();
  updateStatusOnly();
}

function updateCommands(): void {
  const tab = activeTab();
  document.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    const command = button.dataset.command;
    if (["new", "open", "import"].includes(command ?? "")) return;
    if (!tab) { button.disabled = true; return; }
    if (command === "undo") button.disabled = tab.undo.length === 0;
    else if (command === "redo") button.disabled = tab.redo.length === 0;
    else if (command === "export-selection") button.disabled = !selectionBounds(tab);
    else button.disabled = false;
  });
  const selection = tab ? selectionBounds(tab) : null;
  document.querySelectorAll<HTMLButtonElement>("[data-action='copy-hex'],[data-action='copy-text'],[data-action='save-selection'],[data-action='select-all'],[data-action='fill-00'],[data-action='fill-ff'],[data-action='invert'],[data-action='random']").forEach((button) => {
    button.disabled = !tab || (!selection && button.dataset.action !== "select-all");
  });
}

function renderWorkspaceTabs(): void {
  // The strip only earns its row once there is more than one file to switch between.
  // With a single file it repeated what the masthead already shows, for 40px.
  document.querySelector(".studio-shell")?.classList.toggle("has-file-tabs", tabs.length > 1);

  if (tabs.length === 0) {
    workspaceTabs.innerHTML = "<span>Open multiple files to create workspace tabs.</span>";
    return;
  }
  workspaceTabs.innerHTML = tabs.map((tab) => `<button class="workspace-file-tab ${tab.id === activeId ? "active" : ""}" data-tab-id="${tab.id}"><i class="tab-dot ${tab.progress ? "busy" : tab.error ? "error" : tab.patches.size ? "dirty" : ""}"></i><span>${escapeHtml(tab.file.name)}</span><small>${formatBytes(tab.file.size)}</small><b data-close-tab="${tab.id}">×</b></button>`).join("");
}

function renderFileNavigator(): void {
  const tab = activeTab();
  const list = $("#fileNavigatorList") as HTMLDivElement;
  if (!tabs.length) list.innerHTML = "<p>No files open.</p>";
  else list.innerHTML = tabs.map((item) => `<button data-tab-id="${item.id}" class="nav-file ${item.id === activeId ? "active" : ""}"><span>${escapeHtml(item.file.name)}</span><small>${formatBytes(item.file.size)}</small></button>`).join("");
  const info = $("#fileInformation") as HTMLElement;
  if (!tab) {
    info.innerHTML = '<div><dt>Name</dt><dd>—</dd></div><div><dt>Size</dt><dd class="mono">0 bytes</dd></div><div><dt>Modified</dt><dd>—</dd></div><div><dt>Type</dt><dd>—</dd></div>';
    $("#activeFileHeading").textContent = "No file loaded";
    $("#activeFileSubheading").textContent = "Open, drop, or create a binary file to begin";
    return;
  }
  const detected = tab.analysis?.detectedType[0]?.name ?? (tab.progress ? "Analyzing…" : "Unknown");
  info.innerHTML = `<div><dt>Name</dt><dd title="${escapeHtml(tab.file.name)}">${escapeHtml(tab.file.name)}</dd></div><div><dt>Size</dt><dd class="mono">${tab.file.size.toLocaleString()} bytes</dd></div><div><dt>Modified</dt><dd>${new Date(tab.file.lastModified).toLocaleString()}</dd></div><div><dt>Type</dt><dd>${escapeHtml(detected)}</dd></div>`;
  $("#activeFileHeading").textContent = tab.file.name;
  $("#activeFileSubheading").textContent = `${formatBytes(tab.file.size)} · ${detected}`;
}

function renderSidebars(): void {
  const tab = activeTab();
  const selection = tab ? selectionBounds(tab) : null;
  $("#selectionInfo").innerHTML = selection ? `<div><dt>Start</dt><dd>${formatOffset(selection.start)}</dd></div><div><dt>End</dt><dd>${formatOffset(selection.end)}</dd></div><div><dt>Length</dt><dd class="mono">${selection.length.toLocaleString()}</dd></div>` : '<div><dt>Start</dt><dd>—</dd></div><div><dt>End</dt><dd>—</dd></div><div><dt>Length</dt><dd class="mono">0</dd></div>';
  if (!tab) {
    $("#pageCount").textContent = "Page 0 of 0";
    pageSizeSelect.value = "1024";
    void renderInspector();
    return;
  }
  pageSizeSelect.value = String(tab.pageSize);
  const totalPages = Math.max(1, Math.ceil(tab.file.size / tab.pageSize));
  tab.page = Math.min(tab.page, totalPages - 1);
  $("#pageCount").textContent = `Page ${tab.page + 1} of ${totalPages}`;
  const prev = document.querySelector<HTMLButtonElement>("[data-action='previous-page']");
  const next = document.querySelector<HTMLButtonElement>("[data-action='next-page']");
  if (prev) prev.disabled = tab.page <= 0;
  if (next) next.disabled = tab.page >= totalPages - 1;
  void renderInspector();
}

async function renderInspector(): Promise<void> {
  const generation = ++inspectorGeneration;
  const tab = activeTab();
  const target = $("#dataInspector") as HTMLDivElement;
  if (!tab || tab.file.size === 0) { target.innerHTML = "<p>No byte selected.</p>"; return; }
  const bytes = await readRange(tab, tab.cursor, Math.min(16, tab.file.size - tab.cursor));
  if (generation !== inspectorGeneration || tab.id !== activeId) return;
  const padded = new Uint8Array(16);
  padded.set(bytes);
  const view = new DataView(padded.buffer);
  const byte = padded[0] ?? 0;
  target.innerHTML = `<div class="inspector-primary"><label>Offset<input data-inspector-offset value="${formatOffset(tab.cursor)}"></label><label>Byte<input data-inspector-byte value="${byte.toString(16).padStart(2, "0").toUpperCase()}" maxlength="2"></label></div>
  <dl><div><dt>Unsigned 8</dt><dd>${byte}</dd></div><div><dt>Signed 8</dt><dd>${view.getInt8(0)}</dd></div><div><dt>UInt16 LE</dt><dd>${view.getUint16(0, true)}</dd></div><div><dt>UInt16 BE</dt><dd>${view.getUint16(0, false)}</dd></div><div><dt>UInt32 LE</dt><dd>${view.getUint32(0, true)}</dd></div><div><dt>UInt32 BE</dt><dd>${view.getUint32(0, false)}</dd></div><div><dt>Float32 LE</dt><dd>${Number.isFinite(view.getFloat32(0, true)) ? view.getFloat32(0, true).toPrecision(7) : "—"}</dd></div><div><dt>ASCII</dt><dd>${byte >= 32 && byte <= 126 ? escapeHtml(String.fromCharCode(byte)) : "·"}</dd></div></dl>`;
}

function renderViewTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".view-tabs [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeView));
  const count = document.querySelector<HTMLElement>("#intelTabCount");
  const analysis = activeTab()?.analysis;
  if (count) {
    count.textContent = String(analysis?.threat.findings.length ?? 0);
    count.hidden = !analysis;
  }
  renderRiskBadge();
}

function renderActiveView(): void {
  if (activeView === "hex") renderHexView();
  else if (activeView === "signature") renderSignatureView();
  else if (activeView === "intel") renderIntelView();
  else if (activeView === "forensics") renderForensicsView();
  else if (activeView === "comparison") renderComparisonView();
  else if (activeView === "preview") renderPreviewView();
  else renderReportView();
}

// ---------------------------------------------------------------- threat intel

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/** Maps a 0–100 score onto the CSS severity class used for dial and badge colouring. */
function bandSeverityClass(band: string): string {
  if (band === "Critical") return "sev-critical";
  if (band === "High" || band === "Elevated") return "sev-high";
  if (band === "Moderate") return "sev-medium";
  if (band === "Low") return "sev-low";
  return "sev-info";
}

function renderRiskBadge(): void {
  const slot = document.querySelector<HTMLElement>("#riskBadgeSlot");
  if (!slot) return;
  const analysis = activeTab()?.analysis;
  if (!analysis) { slot.innerHTML = ""; return; }
  const { score, band } = analysis.threat;
  slot.innerHTML = `<button class="risk-badge ${bandSeverityClass(band)}" data-view="intel" title="Open the threat intelligence workspace"><i></i><b>${score}</b><span>${escapeHtml(band)}</span></button>`;
}

function renderSeverityStrip(counts: Array<{ severity: Severity; count: number }>): string {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return '<div class="severity-strip"></div>';
  const segments = counts
    .filter((entry) => entry.count > 0)
    .map((entry) => `<i class="${bandSeverityClass("")} sev-${entry.severity}" style="width:${(entry.count / total) * 100}%" title="${entry.count} ${entry.severity}"></i>`)
    .join("");
  return `<div class="severity-strip">${segments}</div>`;
}

function renderFindingCard(finding: ThreatFinding): string {
  const chips = finding.offsets.slice(0, 12).map((offset) => `<button data-jump="${offset}">${formatOffset(offset)}</button>`).join("");
  const extra = finding.offsets.length > 12 ? `<button disabled>+${finding.offsets.length - 12} more</button>` : "";
  return `<article class="finding-card sev-${finding.severity}">
    <div class="finding-head">
      <h4>${escapeHtml(finding.title)}</h4>
      <div class="finding-meta"><em>${escapeHtml(finding.category)}</em><span class="sev-pill sev-${finding.severity}">${severityLabel(finding.severity)} · ${finding.weight.toFixed(1)}</span></div>
    </div>
    <p>${escapeHtml(finding.detail)}</p>
    ${chips ? `<div class="offset-chips">${chips}${extra}</div>` : ""}
    <p class="guidance">${escapeHtml(finding.recommendation)}</p>
  </article>`;
}

/** Compact CSS-only entropy sparkline; buckets keep the maximum so spikes survive. */
function renderEntropySparkline(analysis: FileAnalysis): string {
  const regions = analysis.entropyRegions;
  if (regions.length === 0) return '<div class="table-empty">No entropy windows were measured.</div>';
  const buckets = Math.min(200, regions.length);
  const perBucket = regions.length / buckets;
  const bars: string[] = [];
  for (let index = 0; index < buckets; index += 1) {
    let peak = 0;
    const from = Math.floor(index * perBucket);
    const to = Math.max(from + 1, Math.floor((index + 1) * perBucket));
    for (let inner = from; inner < to && inner < regions.length; inner += 1) peak = Math.max(peak, regions[inner]?.entropy ?? 0);
    const offset = regions[from]?.offset ?? 0;
    const color = peak >= 7.75 ? "var(--sev-critical)" : peak >= 7.35 ? "var(--sev-high)" : peak >= 5 ? "var(--sev-medium)" : "var(--accent)";
    bars.push(`<i style="height:${Math.max(2, (peak / 8) * 100)}%;background:${color}" title="${formatOffset(offset)} · ${peak.toFixed(3)} bits/byte"></i>`);
  }
  return `<div class="entropy-track">${bars.join("")}</div>`;
}

function renderIocTable(analysis: FileAnalysis, filter: IocType | "all"): string {
  const items = analysis.iocs.items.filter((item) => filter === "all" || item.type === filter).slice(0, 3000);
  if (items.length === 0) return '<div class="table-empty">No indicators match the current filter.</div>';
  const rows = items.map((item) => `<button class="intel-row" data-jump="${item.offset}">
    <code>${formatOffset(item.offset)}</code>
    <span>${escapeHtml(item.type)}</span>
    <code title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</code>
    <span class="sev-pill sev-${item.severity}">${severityLabel(item.severity)}</span>
    <span>${escapeHtml(item.note ?? "—")}</span>
  </button>`).join("");
  return `<div class="intel-head"><span>OFFSET</span><span>TYPE</span><span>VALUE</span><span>SEVERITY</span><span>NOTE</span></div>${rows}`;
}

function renderIntelView(): void {
  const tab = activeTab();
  if (!tab) {
    viewContent.innerHTML = `<div class="content-scroll">${emptyCard("Open a file to run threat analysis", "The threat workspace scores capability indicators, extracted indicators of compromise, obfuscation artefacts, and structural anomalies into a single triage view.")}</div>`;
    return;
  }
  const analysis = tab.analysis;
  if (!analysis) {
    viewContent.innerHTML = `<div class="content-scroll">${analysisProgress(tab)}${emptyCard("Waiting for automatic analysis", "Threat scoring runs after identification, hashing, entropy, and string extraction complete.", false)}</div>`;
    return;
  }

  const threat = analysis.threat;
  const counts = SEVERITY_ORDER.map((severity) => ({ severity, count: threat.findings.filter((finding) => finding.severity === severity).length }));
  const categories = Object.entries(threat.categoryScores).sort((left, right) => right[1] - left[1]);
  const maxCategory = Math.max(1, ...categories.map(([, value]) => value));
  const capabilityGroups = summarizeCapabilities(analysis.capabilities);
  const obfuscation = analysis.obfuscation;
  const activeTypes = (Object.entries(analysis.iocs.counts) as Array<[IocType, number]>).filter(([, count]) => count > 0);

  viewContent.innerHTML = `<div class="content-scroll intel-view">${analysisProgress(tab)}

  <section class="intel-hero">
    <div class="risk-dial ${bandSeverityClass(threat.band)}" style="--dial-deg:${(threat.score / 100) * 360};--dial-color:var(--sev-${bandSeverityClass(threat.band).replace("sev-", "")});--dial-glow:var(--accent-wash)">
      <div><strong>${threat.score}</strong><small>OF 100</small><em>${escapeHtml(threat.band.toUpperCase())}</em></div>
    </div>
    <div class="intel-hero-body">
      <h2>Composite threat assessment</h2>
      <p>${escapeHtml(threat.summary)}</p>
      ${renderSeverityStrip(counts)}
      <div class="severity-legend">${counts.map((entry) => `<span><i class="sev-${entry.severity}" style="background:var(--sev-${entry.severity})"></i>${severityLabel(entry.severity)} ${entry.count}</span>`).join("")}</div>
    </div>
  </section>

  <div class="two-column-cards">
    <section class="content-card">
      <div class="card-heading"><h3>SCORE COMPOSITION</h3><span>${categories.length} categor${categories.length === 1 ? "y" : "ies"}</span></div>
      <p>Each category is capped independently so a single noisy signal cannot dominate the composite score.</p>
      ${categories.length ? `<div class="category-bars">${categories.map(([label, value]) => `<div class="category-bar"><span>${escapeHtml(label)}</span><div><i style="width:${(value / maxCategory) * 100}%"></i></div><b>${value.toFixed(1)}</b></div>`).join("")}</div>` : '<div class="table-empty">No category contributed to the score.</div>'}
    </section>
    <section class="content-card">
      <div class="card-heading"><h3>ENTROPY PROFILE</h3><span>${analysis.wholeFileEntropy.toFixed(4)} bits/byte</span></div>
      <p>Peak entropy per sampled window across the whole file. Red bars cross the high-suspicion threshold.</p>
      ${renderEntropySparkline(analysis)}
      <div class="metrics" style="margin-top:calc(var(--u) * 3)">
        <article><strong>${analysis.suspiciousRegions.length}</strong><small>Suspicious regions</small></article>
        <article><strong>${obfuscation.entropyCliffs.length}</strong><small>Entropy cliffs</small></article>
        <article><strong>${obfuscation.scanLimited ? "Sampled" : "Full"}</strong><small>Byte scan coverage</small></article>
      </div>
    </section>
  </div>

  <section class="content-card">
    <div class="card-heading"><h3>THREAT FINDINGS</h3><span>${threat.findings.length} scored</span></div>
    <p>Findings are ordered by severity, then by weight contributed. Offsets are clickable and jump to the hex editor.</p>
    ${threat.findings.length ? `<div class="finding-list">${threat.findings.map(renderFindingCard).join("")}</div>` : '<div class="table-empty">No scored indicators were raised. Absence of indicators is not evidence of safety.</div>'}
  </section>

  <section class="content-card">
    <div class="card-heading"><h3>BEHAVIOURAL CAPABILITIES</h3><span>${analysis.capabilities.length} indicator hit(s)</span></div>
    <p>String literals matching a curated behaviour table. A match proves the text exists in the file; it does not prove the API is imported, reachable, or executed.</p>
    ${capabilityGroups.length ? `<div class="capability-grid">${capabilityGroups.map((group) => `<article class="capability-tile sev-${group.severity}"><b>${group.count}</b><strong>${escapeHtml(group.category)}</strong><small>${severityLabel(group.severity)} severity class</small></article>`).join("")}</div>` : '<div class="table-empty">No capability indicators matched.</div>'}
    ${analysis.capabilities.length ? `<div class="result-table" style="margin-top:calc(var(--u) * 3.5)"><div class="intel-head"><span>OFFSET</span><span>CATEGORY</span><span>INDICATOR</span><span>SEVERITY</span><span>MEANING</span></div>${analysis.capabilities.slice(0, 1200).map((hit) => `<button class="intel-row" data-jump="${hit.offset}"><code>${formatOffset(hit.offset)}</code><span>${escapeHtml(hit.category)}</span><code>${escapeHtml(hit.indicator)}</code><span class="sev-pill sev-${hit.severity}">${severityLabel(hit.severity)}</span><span title="${escapeHtml(hit.description)}">${escapeHtml(hit.description)}</span></button>`).join("")}</div>` : ""}
  </section>

  <section class="content-card">
    <div class="card-heading"><h3>INDICATORS OF COMPROMISE</h3><span>${analysis.iocs.items.length} extracted${analysis.iocs.truncated ? " · truncated" : ""}</span></div>
    <p>Extracted lexically from decoded strings with original byte offsets preserved. No network resolution or reputation lookup was performed.</p>
    <div class="ioc-filters">
      <button data-ioc-filter="all" class="${tab.iocFilter === "all" ? "active" : ""}">All ${analysis.iocs.items.length}</button>
      ${activeTypes.map(([type, count]) => `<button data-ioc-filter="${type}" class="${tab.iocFilter === type ? "active" : ""}">${escapeHtml(type)} ${count}</button>`).join("")}
    </div>
    <div class="intel-table" id="iocTable">${renderIocTable(analysis, tab.iocFilter)}</div>
    <div class="inline-controls"><button data-action="export-iocs">Export indicators as CSV</button><span>Validate every indicator out-of-band before using it for blocking or hunting.</span></div>
  </section>

  <div class="two-column-cards">
    <section class="content-card">
      <div class="card-heading"><h3>OBFUSCATION ARTEFACTS</h3><span>${obfuscation.packerHints.length} packer hint(s)</span></div>
      <p>Packer markers, recovered XOR keys, and well-known cryptographic constant tables found in the sampled regions.</p>
      ${obfuscation.packerHints.length ? `<div class="warning-box">Packer or protector markers: ${escapeHtml(obfuscation.packerHints.join(", "))}</div>` : ""}
      <div class="result-table" style="margin-top:calc(var(--u) * 3)">
        <div class="signature-head"><span>KEY / OFFSET</span><span>ARTEFACT</span><span>EVIDENCE</span><span>CONFIDENCE</span></div>
        ${obfuscation.xorCandidates.map((candidate) => `<button class="signature-row" data-jump="${candidate.offset}"><code>0x${candidate.key.toString(16).toUpperCase().padStart(2, "0")}</code><span>Single-byte XOR key</span><span title="${escapeHtml(candidate.evidence)}">${escapeHtml(candidate.evidence)}</span><b>${Math.round(candidate.confidence * 100)}%</b></button>`).join("")}
        ${obfuscation.cryptoConstants.map((hit) => `<button class="signature-row" data-jump="${hit.offset}"><code>${formatOffset(hit.offset)}</code><span>${escapeHtml(hit.name)}</span><span>${escapeHtml(hit.algorithm)}</span><b>—</b></button>`).join("")}
        ${obfuscation.xorCandidates.length + obfuscation.cryptoConstants.length === 0 ? '<div class="table-empty">No XOR keys or cryptographic constants were recovered.</div>' : ""}
      </div>
    </section>
    <section class="content-card">
      <div class="card-heading"><h3>CODE-LIKE PATTERNS</h3><span>${obfuscation.shellcode.length} match(es)</span></div>
      <p>Position-independent code stubs, sleds, and direct syscall gates. These byte sequences also occur naturally in compiled code.</p>
      <div class="result-table">
        <div class="signature-head"><span>OFFSET</span><span>PATTERN</span><span>INTERPRETATION</span><span>SEVERITY</span></div>
        ${obfuscation.shellcode.slice(0, 400).map((item) => `<button class="signature-row" data-jump="${item.offset}"><code>${formatOffset(item.offset)}</code><span>${escapeHtml(item.pattern)}</span><span title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</span><b class="sev-pill sev-${item.severity}">${severityLabel(item.severity)}</b></button>`).join("") || '<div class="table-empty">No shellcode-style patterns were detected.</div>'}
      </div>
    </section>
  </div>

  <section class="content-card">
    <div class="card-heading"><h3>EMBEDDED EXECUTABLE HEADERS</h3><span>${obfuscation.embeddedExecutables.length} found</span></div>
    <p>Executable headers located beyond offset zero. Nested images are a common dropper structure and should be carved out for separate analysis.</p>
    <div class="result-table">${obfuscation.embeddedExecutables.length ? `<div class="result-head"><span>OFFSET</span><span>TYPE</span><span>ACTION</span></div>${obfuscation.embeddedExecutables.slice(0, 400).map((item) => `<button class="result-row" data-jump="${item.offset}"><code>${formatOffset(item.offset)}</code><span>${escapeHtml(item.name)}</span><span>Jump to offset</span></button>`).join("")}` : '<div class="table-empty">No executable headers were found beyond offset zero.</div>'}</div>
  </section>

  <div class="report-warning">Scores order samples for triage; they are never a detection verdict. Confirm behaviour through dynamic analysis in an isolated environment before acting on any finding in this workspace.</div>
  </div>`;
}

function emptyCard(title: string, message: string, button = true): string {
  return `<div class="empty-file-card"><span class="empty-file-logo">${logoSvg}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${button ? '<button class="primary" data-command="open">Open File</button>' : ""}</div>`;
}

function analysisProgress(tab: EditorTab): string {
  if (tab.error) return `<div class="analysis-banner error"><strong>Analysis failed</strong><span>${escapeHtml(tab.error)}</span><button data-action="reanalyze">Retry</button></div>`;
  if (!tab.progress) return "";
  const percent = tab.progress.total ? Math.min(100, Math.round((tab.progress.completed / tab.progress.total) * 100)) : 0;
  return `<div class="analysis-banner"><strong>Automatic analysis running</strong><span>${escapeHtml(tab.progress.stage)}</span><progress max="100" value="${percent}"></progress><b>${percent}%</b></div>`;
}

function virtualHexHeight(totalRows: number): number {
  return Math.max(1, Math.min(MAX_HEX_SCROLL_HEIGHT, totalRows * hexRowHeight()));
}

function hexScrollTopToRow(scrollTop: number, totalRows: number, height: number, viewportHeight: number): number {
  if (totalRows <= 1) return 0;
  if (totalRows * hexRowHeight() <= MAX_HEX_SCROLL_HEIGHT) return Math.floor(scrollTop / hexRowHeight());
  return Math.floor((scrollTop / Math.max(1, height - viewportHeight)) * Math.max(0, totalRows - 1));
}

function hexRowToTop(row: number, totalRows: number, height: number): number {
  if (totalRows <= 1) return 0;
  if (totalRows * hexRowHeight() <= MAX_HEX_SCROLL_HEIGHT) return row * hexRowHeight();
  return (row / Math.max(1, totalRows - 1)) * Math.max(0, height - hexRowHeight());
}

function windows1252Character(byte: number): string {
  if (byte >= 0x20 && byte <= 0x7E) return String.fromCharCode(byte);
  if (byte >= 0xA0) return String.fromCharCode(byte);
  const map: Record<number, string> = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
    0x88: "ˆ", 0x89: "‰", 0x8A: "Š", 0x8B: "‹", 0x8C: "Œ", 0x8E: "Ž", 0x91: "‘",
    0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
    0x99: "™", 0x9A: "š", 0x9B: "›", 0x9C: "œ", 0x9E: "ž", 0x9F: "Ÿ"
  };
  return map[byte] ?? "·";
}

function visibleCharacter(byte: number): string {
  if (characterMode === "ascii") return byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : "·";
  if (characterMode === "latin1") return byte >= 0x20 && byte !== 0x7F ? String.fromCharCode(byte) : "·";
  return windows1252Character(byte);
}

function hexContentWidth(): number {
  const offset = 112;
  const hex = bytesPerRow * 29 + Math.max(0, bytesPerRow - 1) * 2;
  const ascii = bytesPerRow * 13 + 13;
  return 24 + offset + 14 + hex + 14 + ascii;
}

function updateContinuousPageIndicator(tab: EditorTab, topRow: number): void {
  const topOffset = Math.min(tab.file.size ? tab.file.size - 1 : 0, topRow * bytesPerRow);
  tab.page = Math.floor(topOffset / tab.pageSize);
  const totalPages = Math.max(1, Math.ceil(tab.file.size / tab.pageSize));
  const count = document.querySelector<HTMLElement>("#pageCount");
  if (count) count.textContent = `Page ${Math.min(totalPages, tab.page + 1)} of ${totalPages} · continuous scroll`;
  const prev = document.querySelector<HTMLButtonElement>("[data-action='previous-page']");
  const next = document.querySelector<HTMLButtonElement>("[data-action='next-page']");
  if (prev) prev.disabled = tab.page <= 0;
  if (next) next.disabled = tab.page >= totalPages - 1;
}

function renderHexView(): void {
  const tab = activeTab();
  const headerBytes = Array.from({ length: bytesPerRow }, (_, index) => `<b>${index.toString(16).toUpperCase()}</b>`).join("");
  if (!tab) {
    viewContent.innerHTML = `<div class="hex-view empty-hex"><div class="hex-header-viewport"><div class="hex-column-header"><span class="offset-head">OFFSET</span><div style="--row-bytes:${bytesPerRow}">${headerBytes}</div><span class="ascii-head">TEXT</span></div></div>${emptyCard("Open a file to edit its bytes", "Files stay in this browser. Use Open, drag and drop a file, or create a new binary file. Edited bytes can be saved or exported afterward.")}</div>`;
    return;
  }
  viewContent.innerHTML = `<div class="hex-view">
    <div class="hex-options"><div class="segmented"><button data-input-mode="hex" class="${tab.inputMode === "hex" ? "active" : ""}">HEX</button><button data-input-mode="text" class="${tab.inputMode === "text" ? "active" : ""}">TEXT</button></div><label>Bytes / row<select id="bytesPerRowSelect"><option ${bytesPerRow === 8 ? "selected" : ""}>8</option><option ${bytesPerRow === 16 ? "selected" : ""}>16</option><option ${bytesPerRow === 24 ? "selected" : ""}>24</option><option ${bytesPerRow === 32 ? "selected" : ""}>32</option></select></label><label>Character view<select id="characterModeSelect"><option value="windows-1252" ${characterMode === "windows-1252" ? "selected" : ""}>Windows-1252</option><option value="ascii" ${characterMode === "ascii" ? "selected" : ""}>ASCII</option><option value="latin1" ${characterMode === "latin1" ? "selected" : ""}>Latin-1</option></select></label><button type="button" class="wide-toggle" data-action="toggle-wide" title="Hide the side panels and give the grid the full window (W)">${wideView ? "Exit wide view" : "Wide view"}</button><span>Select a byte to edit its bits in the right panel.</span></div>
    <div class="hex-header-viewport" id="hexHeaderViewport"><div class="hex-column-header" style="--row-bytes:${bytesPerRow};min-width:${hexContentWidth()}px"><span class="offset-head">OFFSET</span><div style="--row-bytes:${bytesPerRow}">${headerBytes}</div><span class="ascii-head">TEXT (${characterMode === "windows-1252" ? "CP1252" : characterMode.toUpperCase()})</span></div></div>
    <div class="hex-top-scroll" id="hexTopScroll" title="Horizontal scrollbar"><div id="hexTopSpacer" style="width:${hexContentWidth()}px"></div></div>
    <div class="hex-grid" id="hexGrid" tabindex="0" aria-label="Hex data, continuously scrollable"><div class="hex-virtual-spacer" id="hexVirtualSpacer"></div><div class="hex-rows" id="hexRows"></div></div>
  </div>`;
  const grid = document.querySelector<HTMLDivElement>("#hexGrid");
  const header = document.querySelector<HTMLDivElement>("#hexHeaderViewport");
  const topScroll = document.querySelector<HTMLDivElement>("#hexTopScroll");
  const spacer = document.querySelector<HTMLDivElement>("#hexVirtualSpacer");
  if (!grid || !header || !topScroll || !spacer) return;

  // Size the spacer before restoring scrollTop. renderHexRows() also sets it, but that
  // path is async: assigning scrollTop against a zero-height scroller makes the browser
  // clamp it to 0, which snapped the grid back to the top of the file on every click
  // once the user had scrolled away.
  const restoreRows = Math.max(1, Math.ceil(tab.file.size / bytesPerRow));
  spacer.style.height = `${virtualHexHeight(restoreRows)}px`;
  spacer.style.width = `${hexContentWidth()}px`;

  grid.scrollTop = tab.hexScrollTop;
  grid.scrollLeft = tab.hexScrollLeft;
  header.scrollLeft = tab.hexScrollLeft;
  topScroll.scrollLeft = tab.hexScrollLeft;
  let syncing = false;
  grid.addEventListener("scroll", () => {
    tab.hexScrollTop = grid.scrollTop;
    tab.hexScrollLeft = grid.scrollLeft;
    if (!syncing) {
      syncing = true;
      header.scrollLeft = grid.scrollLeft;
      topScroll.scrollLeft = grid.scrollLeft;
      syncing = false;
    }
    const totalRows = Math.max(1, Math.ceil(tab.file.size / bytesPerRow));
    updateContinuousPageIndicator(tab, hexScrollTopToRow(grid.scrollTop, totalRows, virtualHexHeight(totalRows), grid.clientHeight));
    if (scrollFrame === 0) {
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        void renderHexRows(tab);
      });
    }
  }, { passive: true });
  topScroll.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    grid.scrollLeft = topScroll.scrollLeft;
    header.scrollLeft = topScroll.scrollLeft;
    tab.hexScrollLeft = topScroll.scrollLeft;
    syncing = false;
  }, { passive: true });
  void renderHexRows(tab);
}

async function renderHexRows(tab: EditorTab): Promise<void> {
  const generation = ++renderGeneration;
  const grid = document.querySelector<HTMLDivElement>("#hexGrid");
  const rowsTarget = document.querySelector<HTMLDivElement>("#hexRows");
  const spacer = document.querySelector<HTMLDivElement>("#hexVirtualSpacer");
  if (!grid || !rowsTarget || !spacer || tab.id !== activeId) return;
  if (tab.file.size === 0) {
    spacer.style.height = "1px";
    rowsTarget.innerHTML = `<div class="empty-file-card compact-empty"><h2>Empty binary file</h2><p>Use Insert to add bytes to this file.</p></div>`;
    return;
  }
  const totalRows = Math.max(1, Math.ceil(tab.file.size / bytesPerRow));
  const virtualHeight = virtualHexHeight(totalRows);
  spacer.style.height = `${virtualHeight}px`;
  spacer.style.width = `${hexContentWidth()}px`;
  const centerRow = hexScrollTopToRow(grid.scrollTop, totalRows, virtualHeight, grid.clientHeight);
  const visibleRows = Math.ceil(Math.max(400, grid.clientHeight) / hexRowHeight()) + HEX_OVERSCAN_ROWS * 2;
  const startRow = Math.max(0, Math.min(totalRows - 1, centerRow - HEX_OVERSCAN_ROWS));
  const endRow = Math.min(totalRows, startRow + visibleRows);
  const startOffset = startRow * bytesPerRow;
  const requested = Math.min(tab.file.size - startOffset, (endRow - startRow) * bytesPerRow);

  // Serve from the cached span when it covers the window. This is the whole point of
  // the cache: an await here means the DOM keeps the previous rows while the user
  // scrolls past them, which is what showed as blank space and flicker.
  let bytes = cachedSlice(tab, startOffset, requested);
  if (!bytes) {
    bytes = await fillReadCache(tab, startOffset, requested);
    if (generation !== renderGeneration || tab.id !== activeId || !rowsTarget.isConnected) return;
  }
  const selection = selectionBounds(tab);
  const rows: string[] = [];
  for (let row = startRow; row < endRow; row += 1) {
    const absoluteStart = row * bytesPerRow;
    const localStart = absoluteStart - startOffset;
    const hexCells: string[] = [];
    const asciiCells: string[] = [];
    for (let column = 0; column < bytesPerRow; column += 1) {
      const local = localStart + column;
      const absolute = absoluteStart + column;
      if (absolute >= tab.file.size || local >= bytes.length) {
        hexCells.push('<span class="hex-byte empty"></span>');
        asciiCells.push('<span class="ascii-byte empty"></span>');
        continue;
      }
      const byte = bytes[local] ?? 0;
      const selected = Boolean(selection && absolute >= selection.start && absolute <= selection.end);
      const current = absolute === tab.cursor;
      const modified = tab.patches.has(absolute);
      const classes = `${selected ? " selected" : ""}${current ? " current" : ""}${modified ? " modified" : ""}`;
      const title = `${formatOffset(absolute)} · 0x${byte.toString(16).padStart(2, "0").toUpperCase()} · ${byte}`;
      hexCells.push(`<button class="hex-byte${classes}" data-byte-offset="${absolute}" title="${title}">${byte.toString(16).padStart(2, "0").toUpperCase()}</button>`);
      asciiCells.push(`<button class="ascii-byte${classes}" data-byte-offset="${absolute}" title="${title}">${escapeHtml(visibleCharacter(byte))}</button>`);
    }
    const top = hexRowToTop(row, totalRows, virtualHeight);
    const holdsCursor = tab.cursor >= absoluteStart && tab.cursor < absoluteStart + bytesPerRow;
    rows.push(`<div class="hex-row${holdsCursor ? " has-cursor" : ""}" style="top:${top}px;min-width:${hexContentWidth()}px"><button class="row-offset" data-byte-offset="${absoluteStart}">${formatOffset(absoluteStart)}</button><div class="hex-cells" style="--row-bytes:${bytesPerRow}">${hexCells.join("")}</div><div class="ascii-cells" style="--row-bytes:${bytesPerRow}">${asciiCells.join("")}</div></div>`);
  }
  rowsTarget.innerHTML = rows.join("");
  updateContinuousPageIndicator(tab, centerRow);
}

/**
 * Repaints one byte in place, in both the hex and character columns.
 *
 * Editing must not rebuild the grid. The cells are buttons, so replacing the DOM
 * mid-edit drops focus, which breaks two-keystroke nibble entry. Only the touched
 * cell is updated.
 */
async function repaintByte(tab: EditorTab, offset: number): Promise<void> {
  if (tab.id !== activeId) return;
  const value = await readByte(tab, offset);
  const hexText = value.toString(16).padStart(2, "0").toUpperCase();
  const title = `${formatOffset(offset)} · 0x${hexText} · ${value}`;
  const modified = tab.patches.has(offset);
  const pending = tab.nibble === 1 && offset === tab.cursor;

  for (const cell of document.querySelectorAll<HTMLElement>(`[data-byte-offset="${offset}"]`)) {
    if (cell.classList.contains("row-offset")) continue;
    cell.title = title;
    cell.classList.toggle("modified", modified);
    cell.classList.toggle("half-entered", pending);
    if (cell.classList.contains("hex-byte")) cell.textContent = hexText;
    else if (cell.classList.contains("ascii-byte")) cell.textContent = visibleCharacter(value);
  }
}

function renderSignatureView(): void {
  const tab = activeTab();
  if (!tab) { viewContent.innerHTML = `<div class="content-scroll">${emptyCard("No file loaded", "Select a file to run magic-number, extension, and structure analysis.")}${signatureRulesTable()}</div>`; return; }
  const analysis = tab.analysis;
  const best = analysis?.detectedType[0];
  const extension = tab.file.name.includes(".") ? `.${tab.file.name.split(".").pop()?.toLowerCase() ?? ""}` : "none";
  const extensionMatch = best?.extensions.includes(extension) ?? false;
  viewContent.innerHTML = `<div class="content-scroll signature-view">${analysisProgress(tab)}
    <section class="hero-analysis"><div><h2>${escapeHtml(best?.name ?? (tab.progress ? "Analyzing file…" : "Unknown binary data"))}</h2><p>${escapeHtml(best?.reason ?? "No conclusive built-in signature has been found yet.")}</p></div><span class="status-chip ${best ? "success" : ""}">${best ? `${Math.round(best.confidence * 100)}% MATCH` : tab.progress ? "ANALYZING" : "UNKNOWN"}</span></section>
    <div class="four-cards"><article><h3>SIGNATURE</h3><strong>${escapeHtml(best?.name ?? "—")}</strong><small>${escapeHtml(best?.offsets.map(formatOffset).join(", ") ?? "No signature offset")}</small></article><article><h3>EXTENSION CHECK</h3><strong>${escapeHtml(extension)}</strong><small>${extensionMatch ? "Extension agrees with detected type" : best ? "Extension does not confirm the signature" : "No confirmed type"}</small></article><article><h3>HEADER PREVIEW</h3><code id="headerPreview">Loading…</code></article><article><h3>NOTES</h3><strong>${analysis?.details["Container"] ?? analysis?.details["Format family"] ?? "—"}</strong><small>${analysis?.detectedType.length ?? 0} candidate type(s)</small></article></div>
    <section class="content-card"><div class="card-heading"><h3>MATCHING RULES</h3><span>${BUILTIN_SIGNATURES.length.toLocaleString()} built-in rules</span></div>${signatureRulesTable()}</section>
  </div>`;
  void loadHeaderPreview(tab);
}

async function loadHeaderPreview(tab: EditorTab): Promise<void> {
  const target = document.querySelector<HTMLElement>("#headerPreview");
  if (!target) return;
  const bytes = await readRange(tab, 0, Math.min(64, tab.file.size));
  if (!target.isConnected || tab.id !== activeId) return;
  target.textContent = [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ") || "—";
}

function signatureRulesTable(): string {
  const rows = BUILTIN_SIGNATURES.slice(0, 90).map((rule) => `<div class="rule-row"><span>${escapeHtml(rule.name)}</span><code>${formatOffset(rule.offset ?? 0)}</code><code>${rule.pattern.map((value, index) => (rule.mask?.[index] === 0 ? "??" : value.toString(16).padStart(2, "0").toUpperCase())).join(" ")}</code><span>${escapeHtml(rule.extensions.join(", ") || "binary")}</span></div>`).join("");
  return `<div class="rules-table"><div class="rule-head"><span>TYPE</span><span>OFFSET</span><span>MAGIC / RULE</span><span>EXPECTED EXTENSIONS</span></div>${rows}</div>`;
}

function renderForensicsView(): void {
  const tab = activeTab();
  if (!tab) { viewContent.innerHTML = `<div class="content-scroll">${emptyCard("Open a file to use the Forensics Lab", "Hashes, strings, entropy, signatures, search, bit editing, conversion, and source export begin with a local file.")}</div>`; return; }
  const analysis = tab.analysis;
  viewContent.innerHTML = `<div class="content-scroll forensics-view">${analysisProgress(tab)}
    <div class="two-column-cards">
      <section class="content-card"><div class="card-heading"><h3>HASH CALCULATORS</h3><button data-action="copy-hashes" ${analysis ? "" : "disabled"}>Copy all</button></div><p>Hashes calculate automatically from the current analyzed byte stream.</p><div class="hash-table">${analysis ? analysis.hashes.map((hash) => `<div><strong>${escapeHtml(hash.algorithm)}</strong><code>${escapeHtml(hash.value)}</code><button data-copy="${escapeHtml(hash.value)}">Copy</button></div>`).join("") : "<span>Waiting for analysis…</span>"}</div></section>
      <section class="content-card"><div class="card-heading"><h3>ENTROPY & SUSPICIOUS REGIONS</h3><span>${analysis ? analysis.wholeFileEntropy.toFixed(4) : "—"}</span></div><p>High entropy can indicate compression, packing, or encryption; it is not proof of malicious content.</p><div class="metrics">${analysis ? `<article><strong>${analysis.wholeFileEntropy.toFixed(4)}</strong><small>Whole-file entropy</small></article><article><strong>${analysis.suspiciousRegions.length}</strong><small>Suspicious regions</small></article><article><strong>${analysis.entropyRegions.length}</strong><small>Measured windows</small></article>` : "<span>Waiting for analysis…</span>"}</div><div class="mini-list">${analysis?.suspiciousRegions.slice(0, 20).map((region) => `<button data-jump="${region.offset}"><code>${formatOffset(region.offset)}</code><span>${escapeHtml(region.reason)}</span><b>${region.entropy.toFixed(3)}</b></button>`).join("") ?? ""}</div></section>
    </div>
    <section class="content-card" id="advancedSearch"><div class="card-heading"><h3>ADVANCED SEARCH</h3><span>${tab.searchResults.length.toLocaleString()} result(s)</span></div><div class="search-grid"><label>Mode<select id="searchMode"><option value="hex">Hex pattern</option><option value="text">Text</option><option value="regex">Regular expression</option><option value="uint">Unsigned integer</option><option value="int">Signed integer</option><option value="float">Floating point</option></select></label><label class="search-value">Value<input id="searchValue" placeholder="50 4B ?? 04, text, integer, or regex"></label><label>Encoding<select id="searchEncoding"><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option></select></label><label>Width<select id="searchWidth"><option value="1">1 byte</option><option value="2">2 bytes</option><option value="4" selected>4 bytes</option><option value="8">8 bytes</option></select></label><label>Endian<select id="searchEndian"><option value="little">Little</option><option value="big">Big</option></select></label><label>Maximum<input id="searchMax" type="number" min="1" max="100000" value="10000"></label><label class="checkbox-label"><input id="searchCase" type="checkbox" checked> Case sensitive</label><button class="primary" data-action="run-search">Search File</button></div><div class="result-table">${renderSearchResults(tab.searchResults)}</div></section>
    <section class="content-card"><div class="card-heading"><h3>STRING EXTRACTION</h3><span>${analysis?.strings.length.toLocaleString() ?? 0} string(s)</span></div><p>Automatic, stack-safe ASCII, UTF-8, UTF-16LE, and UTF-16BE extraction with original byte offsets.</p><div class="inline-controls"><input id="stringFilter" placeholder="Filter extracted strings"><button data-action="export-strings" ${analysis ? "" : "disabled"}>Export CSV</button></div><div class="result-table" id="stringResults">${analysis ? renderStrings(analysis, "") : "<p>Waiting for automatic analysis…</p>"}</div></section>
    <section class="content-card"><div class="card-heading"><h3>EMBEDDED FILE / SIGNATURE SCANNER</h3><span>${analysis?.signatureHits.length.toLocaleString() ?? 0} marker(s)</span></div><p>The entire configured scan range is checked for known embedded headers, not only the beginning of the file.</p><div class="inline-controls"><button data-action="reanalyze" class="primary">Rescan / Reanalyze</button><button data-action="export-signatures" ${analysis ? "" : "disabled"}>Export Results CSV</button></div><div class="result-table">${analysis ? renderSignatureHits(analysis) : "<p>Waiting for automatic analysis…</p>"}</div></section>
    <div class="two-column-cards">
      <section class="content-card"><div class="card-heading"><h3>BIT EDITOR</h3><span>${formatOffset(tab.cursor)}</span></div><div id="bitEditor">Loading byte…</div></section>
      <section class="content-card"><div class="card-heading"><h3>BASE CONVERTER</h3></div><p>Convert arbitrarily large integers between bases 2–36.</p><div class="base-grid"><label>Value<input id="baseValue" value="FF"></label><label>From<input id="baseFrom" type="number" min="2" max="36" value="16"></label><label>To<input id="baseTo" type="number" min="2" max="36" value="10"></label></div><output id="baseOutput">255</output></section>
    </div>
    <section class="content-card"><div class="card-heading"><h3>EXPORT AS SOURCE CODE</h3></div><div class="source-grid"><label>Language<select id="sourceLanguage"><option value="c">C</option><option value="cpp">C++</option><option value="rust">Rust</option><option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="java">Java</option><option value="go">Go</option><option value="csharp">C#</option></select></label><label>Variable<input id="sourceVariable" value="binary_data"></label><label>Start offset<input id="sourceStart" value="0x0"></label><label>Length<input id="sourceLength" value="${Math.min(tab.file.size, 4096)}"></label><button class="primary" data-action="export-source">Export Source</button></div></section>
  </div>`;
  void renderBitEditor(tab);
}

function renderSearchResults(results: SearchResult[]): string {
  if (!results.length) return '<div class="table-empty">No search results.</div>';
  return `<div class="result-head"><span>OFFSET</span><span>LENGTH</span><span>PREVIEW</span></div>${results.slice(0, 5000).map((result) => `<button class="result-row" data-jump="${result.offset}"><code>${formatOffset(result.offset)}</code><span>${result.length}</span><code>${escapeHtml(result.previewHex)}</code></button>`).join("")}`;
}

function renderStrings(analysis: FileAnalysis, query: string): string {
  const normalized = query.trim().toLowerCase();
  const items = analysis.strings.filter((item) => !normalized || item.value.toLowerCase().includes(normalized) || item.encoding.toLowerCase().includes(normalized) || formatOffset(item.offset).toLowerCase().includes(normalized)).slice(0, 5000);
  if (!items.length) return '<div class="table-empty">No strings match the current filter.</div>';
  return `<div class="string-head"><span>OFFSET</span><span>ENCODING</span><span>LENGTH</span><span>STRING</span></div>${items.map((item) => `<button class="string-row" data-jump="${item.offset}"><code>${formatOffset(item.offset)}</code><span>${item.encoding}</span><span>${item.byteLength}</span><code>${escapeHtml(item.value)}</code></button>`).join("")}`;
}

function renderSignatureHits(analysis: FileAnalysis): string {
  if (!analysis.signatureHits.length) return '<div class="table-empty">No embedded markers were found.</div>';
  return `<div class="signature-head"><span>OFFSET</span><span>DETECTED MARKER</span><span>EXTENSIONS</span><span>CONFIDENCE</span></div>${analysis.signatureHits.slice(0, 5000).map((hit) => `<button class="signature-row" data-jump="${hit.offset}"><code>${formatOffset(hit.offset)}</code><span>${escapeHtml(hit.name)}</span><span>${escapeHtml(hit.extensions.join(", ") || "binary")}</span><b>${Math.round(hit.confidence * 100)}%</b></button>`).join("")}`;
}

async function renderBitEditor(tab: EditorTab): Promise<void> {
  const target = document.querySelector<HTMLDivElement>("#bitEditor");
  if (!target) return;
  const byte = tab.file.size ? await readByte(tab, tab.cursor) : 0;
  if (!target.isConnected || tab.id !== activeId) return;
  const bits = byteToBits(byte);
  target.innerHTML = `<div class="bit-summary"><code>${byte.toString(16).padStart(2, "0").toUpperCase()}</code><strong>${byte}</strong></div><div class="bit-boxes">${Array.from(bits).map((bit, index) => `<label><small>${7 - index}</small><input type="checkbox" data-bit="${7 - index}" ${bit === "1" ? "checked" : ""}><b>${bit}</b></label>`).join("")}</div><label class="stack-label">Binary<input id="binaryByteInput" value="${bits}" maxlength="8"></label>`;
}

function renderComparisonView(): void {
  const tab = activeTab();
  if (!tab) { viewContent.innerHTML = `<div class="content-scroll">${emptyCard("Open a file to compare binary data", "Compare the active file against another workspace tab or an external local file.")}</div>`; return; }
  const otherTabs = tabs.filter((item) => item.id !== tab.id);
  const differentBytes = tab.differences.reduce((sum, item) => sum + Math.max(item.leftLength, item.rightLength), 0);
  const equalPositions = Math.max(0, Math.min(tab.file.size, tab.compareFile?.size ?? 0) - differentBytes);
  const denominator = Math.max(tab.file.size, tab.compareFile?.size ?? 0, 1);
  const similarity = tab.compareFile ? Math.max(0, (1 - differentBytes / denominator) * 100) : 0;
  viewContent.innerHTML = `<div class="content-scroll comparison-view"><section class="content-card"><div class="card-heading"><h3>BINARY FILE COMPARISON</h3></div><p>Compare the active file against another open workspace tab or an external file. Difference ranges are byte-accurate and navigable.</p><div class="compare-controls"><select id="compareTabSelect"><option value="">Choose another open tab</option>${otherTabs.map((item) => `<option value="${item.id}">${escapeHtml(item.file.name)}</option>`).join("")}</select><button data-action="choose-compare">Load External Comparison File</button><button class="primary" data-action="run-tab-compare">Compare</button></div><div class="inline-controls"><button data-action="previous-difference">Previous Difference</button><button data-action="next-difference">Next Difference</button><span>${tab.compareFile ? `Compared with ${escapeHtml(tab.compareFile.name)}` : "Choose a comparison target."}</span></div>
    <div class="comparison-metrics"><article><span>CURRENT SIZE</span><strong>${tab.file.size.toLocaleString()}</strong></article><article><span>OTHER SIZE</span><strong>${tab.compareFile?.size.toLocaleString() ?? "—"}</strong></article><article><span>DIFFERENT BYTES</span><strong>${tab.compareFile ? differentBytes.toLocaleString() : "—"}</strong></article><article><span>SIMILARITY</span><strong>${tab.compareFile ? `${similarity.toFixed(3)}%` : "—"}</strong></article><article><span>EQUAL POSITIONS</span><strong>${tab.compareFile ? equalPositions.toLocaleString() : "—"}</strong></article><article><span>SIZE DELTA</span><strong>${tab.compareFile ? (tab.compareFile.size - tab.file.size).toLocaleString() : "—"}</strong></article><article><span>FIRST DIFFERENCE</span><strong>${tab.differences[0] ? formatOffset(tab.differences[0].offset) : "—"}</strong></article><article><span>LAST DIFFERENCE</span><strong>${tab.differences.at(-1) ? formatOffset(tab.differences.at(-1)?.offset ?? 0) : "—"}</strong></article></div>
    <div class="result-table comparison-table"><div class="comparison-head"><span>#</span><span>OFFSET</span><span>CURRENT</span><span>OTHER</span><span>STATE</span></div>${tab.differences.length ? tab.differences.slice(0, 5000).map((item, index) => `<button class="comparison-row" data-jump="${item.offset}"><span>${index + 1}</span><code>${formatOffset(item.offset)}</code><code>${escapeHtml(item.leftHex || "∅")}</code><code>${escapeHtml(item.rightHex || "∅")}</code><b>Different</b></button>`).join("") : '<div class="table-empty">No comparison results.</div>'}</div></section></div>`;
}

function renderPreviewView(): void {
  const tab = activeTab();
  if (!tab) { viewContent.innerHTML = `<div class="content-scroll">${emptyCard("Open a file for PE analysis and preview", "Supported images render locally. PE/COFF files receive architecture, subsystem, entry-point, and section analysis.")}</div>`; return; }
  const pe = tab.analysis?.pe;
  viewContent.innerHTML = `<div class="content-scroll preview-view">${analysisProgress(tab)}<div class="two-column-cards preview-columns"><section class="content-card"><div class="card-heading"><h3>IMAGE / NATIVE PREVIEW</h3></div><div id="imagePreview" class="image-preview"><span>Checking browser decoder…</span></div></section><section class="content-card"><div class="card-heading"><h3>PE / COFF ANALYZER</h3><span>${pe?.valid ? "VALID PE" : "NOT PE"}</span></div>${pe?.valid ? `<div class="pe-values"><div><span>Architecture</span><strong>${escapeHtml(pe.architecture ?? "Unknown")}</strong></div><div><span>Subsystem</span><strong>${escapeHtml(pe.subsystem ?? "Unknown")}</strong></div><div><span>Entry point</span><strong>${pe.entryPoint === undefined ? "Unknown" : formatOffset(pe.entryPoint)}</strong></div><div><span>Image base</span><strong>${escapeHtml(pe.imageBase ?? "Unknown")}</strong></div><div><span>Sections</span><strong>${pe.sectionCount ?? 0}</strong></div><div><span>Timestamp</span><strong>${pe.timestamp ? new Date(pe.timestamp * 1000).toLocaleString() : "Unknown"}</strong></div></div>${pe.warnings.map((warning) => `<div class="warning-box">${escapeHtml(warning)}</div>`).join("")}<div class="pe-table"><div class="pe-head"><span>Name</span><span>Raw offset</span><span>Raw size</span><span>Entropy</span></div>${(pe.sections ?? []).map((section) => `<button data-jump="${section.rawOffset}"><strong>${escapeHtml(section.name)}</strong><code>${formatOffset(section.rawOffset)}</code><span>${formatBytes(section.rawSize)}</span><b>${section.entropy?.toFixed(4) ?? "—"}</b></button>`).join("")}</div>` : `<div class="table-empty">The active file is not a validated PE/COFF image.</div>`}</section></div></div>`;
  void initializePreview(tab);
}

async function initializePreview(tab: EditorTab): Promise<void> {
  const target = document.querySelector<HTMLDivElement>("#imagePreview");
  if (!target) return;
  tab.preview?.revoke();
  tab.preview = undefined;
  const file = currentEffectiveFile(tab);
  const decodable = await canBrowserDecodeImage(file);
  if (!target.isConnected || tab.id !== activeId) return;
  if (!decodable) { target.innerHTML = '<span>Browser-native preview is unavailable for this format. Hex editing and binary analysis remain available.</span>'; return; }
  const handle = createNativeImagePreview(file) ?? (() => { const url = URL.createObjectURL(file); return { url, revoke: () => URL.revokeObjectURL(url) }; })();
  tab.preview = handle;
  target.innerHTML = `<img src="${handle.url}" alt="Preview of ${escapeHtml(tab.file.name)}">`;
}

function reportPreviewText(tab: EditorTab): string {
  const analysis = tab.analysis;
  if (!analysis) return "Automatic analysis is not complete yet.";
  const lines = [
    "HEXFORGE STUDIO PRO — FORENSIC BINARY REPORT",
    "================================================",
    `Filename: ${analysis.filename}`,
    `Size: ${analysis.size.toLocaleString()} bytes`,
    `Detected type: ${analysis.detectedType.map((item) => `${item.name} (${Math.round(item.confidence * 100)}%)`).join("; ") || "Unknown"}`,
    `Analyzed at: ${new Date(analysis.analyzedAt).toLocaleString()}`,
    `Analyst: ${tab.analyst || "Not provided"}`,
    `Case / Project ID: ${tab.caseId || "Not provided"}`,
    `Evidence number: ${tab.evidenceNumber || "Not provided"}`,
    `Organization: ${tab.organization || "Not provided"}`,
    `Classification: ${tab.classification || "Unclassified"}`,
    "",
    "=== THREAT ASSESSMENT ===",
    `Composite score: ${analysis.threat.score}/100 (${analysis.threat.band})`,
    analysis.threat.summary,
    ...analysis.threat.findings.slice(0, 20).map((finding) => `  [${finding.severity.toUpperCase()}] ${finding.title} — ${finding.detail}`),
    analysis.threat.findings.length > 20 ? `  … ${analysis.threat.findings.length - 20} further finding(s)` : "",
    "",
    "=== HASHES ===",
    ...analysis.hashes.map((hash) => `${hash.algorithm}: ${hash.value}`),
    "",
    "=== SIGNATURE & ENTROPY SUMMARY ===",
    `Whole-file entropy: ${analysis.wholeFileEntropy.toFixed(5)}`,
    `Embedded signatures: ${analysis.signatureHits.length}`,
    `Suspicious regions: ${analysis.suspiciousRegions.length}`,
    `Extracted strings: ${analysis.strings.length}`,
    `Capability indicators: ${analysis.capabilities.length}`,
    `Indicators of compromise: ${analysis.iocs.items.length}`,
    `Packer hints: ${analysis.obfuscation.packerHints.join(", ") || "none"}`,
    "",
    "=== USER / ANALYST NOTES ===",
    tab.notes || "No analyst notes provided.",
    "",
    "=== METHODOLOGY AND LIMITATIONS ===",
    "All analysis was performed locally in the browser against the active byte stream. Signature matches and suspicious-region flags are analytical indicators and should be validated with format-specific forensic tools."
  ];
  return lines.join("\n");
}

function renderReportView(): void {
  const tab = activeTab();
  if (!tab) { viewContent.innerHTML = `<div class="content-scroll">${emptyCard("Open a file to generate a PDF report", "The report includes filename, size, detected type, hashes, signature evidence, entropy, strings, suspicious regions, PE information, and analyst notes.")}</div>`; return; }
  const ready = Boolean(tab.analysis);
  const threat = tab.analysis?.threat;
  viewContent.innerHTML = `<div class="content-scroll report-view">${analysisProgress(tab)}
  <section class="content-card">
    <div class="card-heading"><h3>FORENSIC DOSSIER GENERATOR</h3><span>${ready ? "ANALYSIS COMPLETE" : "WAITING FOR ANALYSIS"}</span></div>
    <p>The dossier includes a cover page with a risk gauge, an executive summary, a table of contents, vector entropy and byte-distribution charts, a scored findings register, capability and indicator appendices, a PE section map, a hexadecimal excerpt, and a chain-of-custody continuation block.</p>
    ${threat ? `<div class="metrics" style="margin-bottom:calc(var(--u) * 3.5)"><article><strong>${threat.score}</strong><small>Threat score</small></article><article><strong>${threat.findings.length}</strong><small>Findings</small></article><article><strong>${tab.analysis?.iocs.items.length ?? 0}</strong><small>Indicators</small></article><article><strong>${tab.analysis?.capabilities.length ?? 0}</strong><small>Capability hits</small></article></div>` : ""}

    <h3 style="margin:0 0 calc(var(--u) * 2);font-size:var(--fs-nano);letter-spacing:.1em;color:var(--faint)">CASE METADATA</h3>
    <div class="report-controls">
      <label>Examiner<input id="reportAnalyst" value="${escapeHtml(tab.analyst)}" placeholder="Analyst name"></label>
      <label>Case / project<input id="reportCaseId" value="${escapeHtml(tab.caseId)}" placeholder="Case or project identifier"></label>
      <label>Evidence number<input id="reportEvidence" value="${escapeHtml(tab.evidenceNumber)}" placeholder="Exhibit or evidence number"></label>
      <label>Organization<input id="reportOrganization" value="${escapeHtml(tab.organization)}" placeholder="Laboratory or team"></label>
      <label>Acquisition method<input id="reportAcquisition" value="${escapeHtml(tab.acquisitionMethod)}" placeholder="How the item was obtained"></label>
      <label>Classification banner<input id="reportClassification" value="${escapeHtml(tab.classification)}" placeholder="e.g. INTERNAL USE ONLY"></label>
    </div>

    <label class="stack-label" style="margin-top:calc(var(--u) * 2)">Examiner notes<textarea id="reportNotes" placeholder="Observations, evidence source, handling notes, offsets of interest…">${escapeHtml(tab.notes)}</textarea></label>

    <div class="report-controls">
      <label>Detail level<select id="reportDetail"><option value="summary" ${tab.reportDetail === "summary" ? "selected" : ""}>Summary — capped tables</option><option value="standard" ${tab.reportDetail === "standard" ? "selected" : ""}>Standard — balanced</option><option value="full" ${tab.reportDetail === "full" ? "selected" : ""}>Full — maximum rows</option></select></label>
      <label class="checkbox-label" style="align-self:end"><input type="checkbox" id="reportHexExcerpt" ${tab.includeHexExcerpt ? "checked" : ""}> Include hexadecimal excerpt from the cursor</label>
    </div>

    <div class="inline-controls">
      <button class="primary" data-action="generate-report" ${ready ? "" : "disabled"}>Download Forensic Dossier (PDF)</button>
      <button data-action="refresh-report">Refresh Preview</button>
      <span>Generated locally in this browser. Nothing is uploaded.</span>
    </div>
    <progress class="report-progress" max="100" value="${ready ? 100 : 10}"></progress>
    <textarea class="report-preview" id="reportPreview" readonly>${escapeHtml(reportPreviewText(tab))}</textarea>
    <div class="report-warning">Large-file entropy, string, and signature analysis can require substantial CPU and memory. Full-detail dossiers on files with many thousands of strings produce correspondingly large PDFs.</div>
  </section></div>`;
}

function updateStatusOnly(): void {
  const tab = activeTab();
  const target = $("#globalStatus") as HTMLElement;
  if (!tab) { target.innerHTML = '<span>Offset: — &nbsp;&nbsp; Selection: 0 bytes &nbsp;&nbsp; Size: 0 bytes</span><span>HEX / Windows-1252</span><span>Ready</span>'; return; }
  const selection = selectionBounds(tab);
  const stage = tab.progress ? `${tab.progress.stage} ${tab.progress.total ? Math.round(tab.progress.completed / tab.progress.total * 100) : 0}%` : tab.error ? "Analysis error" : tab.analysis ? "Analysis ready" : "Queued";
  target.innerHTML = `<span>Offset: ${formatOffset(tab.cursor)} &nbsp;&nbsp; Selection: ${selection?.length.toLocaleString() ?? 0} bytes &nbsp;&nbsp; Size: ${tab.file.size.toLocaleString()} bytes &nbsp;&nbsp; Modified: ${tab.patches.size.toLocaleString()}</span><span>${tab.inputMode.toUpperCase()} / Windows-1252</span><span>${escapeHtml(stage)}</span>`;
}

async function copySelection(asText: boolean): Promise<void> {
  const tab = activeTab();
  const bounds = tab ? selectionBounds(tab) : null;
  if (!tab || !bounds) return;
  const bytes = await readRange(tab, bounds.start, bounds.length);
  const output = asText ? Array.from(bytes, (value) => value >= 32 && value <= 126 ? String.fromCharCode(value) : ".").join("") : [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  await navigator.clipboard.writeText(output);
  toast(asText ? "Selection copied as text." : "Selection copied as hexadecimal.", "success");
}

async function exportSelection(): Promise<void> {
  const tab = activeTab();
  const bounds = tab ? selectionBounds(tab) : null;
  if (!tab || !bounds) return;
  const bytes = await readRange(tab, bounds.start, bounds.length);
  downloadBlob(new Blob([bytes.slice().buffer as ArrayBuffer]), `${tab.file.name}.selection-${bounds.start.toString(16)}-${bounds.end.toString(16)}.bin`);
}

async function bulkSelectionOperation(mode: "fill00" | "fillff" | "invert" | "random"): Promise<void> {
  const tab = activeTab();
  const bounds = tab ? selectionBounds(tab) : null;
  if (!tab || !bounds) return;
  if (bounds.length > 64 * 1024 * 1024 && !window.confirm(`This will modify ${formatBytes(bounds.length)}. Continue?`)) return;
  const current = await readRange(tab, bounds.start, bounds.length);
  const output = new Uint8Array(current.length);
  for (let index = 0; index < output.length; index += 1) {
    if (mode === "fill00") output[index] = 0;
    else if (mode === "fillff") output[index] = 0xFF;
    else if (mode === "invert") output[index] = 0xFF ^ (current[index] ?? 0);
    else output[index] = crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
  }
  setBytes(tab, bounds.start, output, mode === "fill00" ? "Fill 00" : mode === "fillff" ? "Fill FF" : mode === "invert" ? "Invert selection" : "Randomize selection");
}

async function insertBytes(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  showModal("Insert bytes", `<p>Insert bytes before the current cursor. This operation changes the file size.</p><div class="modal-grid"><label>Number of bytes<input id="insertLength" type="number" min="1" max="268435456" value="1"></label><label>Fill byte (hex)<input id="insertFill" value="00" maxlength="2"></label></div><div class="modal-actions"><button data-modal-close>Cancel</button><button class="primary" data-modal-submit="insert">Insert Bytes</button></div>`);
}

async function deleteSelection(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  const bounds = selectionBounds(tab) ?? { start: tab.cursor, end: tab.cursor, length: 1 };
  if (!window.confirm(`Delete ${bounds.length.toLocaleString()} byte(s) from ${formatOffset(bounds.start)}?`)) return;
  const current = patchedBlob(tab);
  const afterBlob = new Blob([current.slice(0, bounds.start), current.slice(bounds.end + 1)], { type: tab.file.type });
  const after = new File([afterBlob], tab.file.name, { type: tab.file.type, lastModified: Date.now() });
  replaceTabFile(tab, after, "Delete bytes");
}

async function performInsert(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  const length = Number((document.querySelector<HTMLInputElement>("#insertLength")?.value ?? "0"));
  const fillText = document.querySelector<HTMLInputElement>("#insertFill")?.value ?? "00";
  if (!Number.isSafeInteger(length) || length < 1 || length > 268_435_456) throw new Error("Insert length must be between 1 and 268,435,456 bytes.");
  if (!/^[0-9a-f]{1,2}$/i.test(fillText)) throw new Error("Fill byte must be one or two hexadecimal digits.");
  const fill = Number.parseInt(fillText, 16);
  const current = patchedBlob(tab);
  const insertion = new Uint8Array(length);
  insertion.fill(fill);
  const at = tab.file.size === 0 ? 0 : tab.cursor;
  const after = new File([current.slice(0, at), insertion, current.slice(at)], tab.file.name, { type: tab.file.type, lastModified: Date.now() });
  closeModal();
  replaceTabFile(tab, after, "Insert bytes");
}

function showNewFileModal(): void {
  showModal("Create new binary file", `<p>Create a zero-filled local binary file and open it as a new workspace tab.</p><div class="modal-grid"><label>Filename<input id="newFilename" value="untitled.bin"></label><label>Size in bytes<input id="newFileSize" type="number" min="0" max="268435456" value="1024"></label></div><div class="modal-actions"><button data-modal-close>Cancel</button><button class="primary" data-modal-submit="new">Create File</button></div>`);
}

function createNewFile(): void {
  const name = document.querySelector<HTMLInputElement>("#newFilename")?.value.trim() || "untitled.bin";
  const size = Number(document.querySelector<HTMLInputElement>("#newFileSize")?.value ?? "0");
  if (!Number.isSafeInteger(size) || size < 0 || size > 268_435_456) throw new Error("Size must be between 0 and 268,435,456 bytes.");
  closeModal();
  openFiles([new File([new Uint8Array(size)], name, { type: "application/octet-stream", lastModified: Date.now() })]);
}

function showImportModal(): void {
  showModal("Import data", `<p>Paste hexadecimal bytes, UTF-8 text, Base64, or a decimal byte list to create a new file.</p><div class="modal-grid"><label>Input format<select id="importFormat"><option value="hex">Hexadecimal</option><option value="text">UTF-8 text</option><option value="base64">Base64</option><option value="decimal">Decimal bytes</option></select></label><label>Filename<input id="importFilename" value="imported.bin"></label></div><label class="stack-label">Data<textarea id="importData" placeholder="48 65 6C 6C 6F"></textarea></label><div class="modal-actions"><button data-modal-close>Cancel</button><button class="primary" data-modal-submit="import">Import Data</button></div>`);
}

function importData(): void {
  const format = document.querySelector<HTMLSelectElement>("#importFormat")?.value ?? "hex";
  const name = document.querySelector<HTMLInputElement>("#importFilename")?.value.trim() || "imported.bin";
  const data = document.querySelector<HTMLTextAreaElement>("#importData")?.value ?? "";
  let bytes: Uint8Array;
  if (format === "hex") bytes = parseHexBytes(data);
  else if (format === "text") bytes = new TextEncoder().encode(data);
  else if (format === "base64") {
    const binary = atob(data.replace(/\s+/g, ""));
    bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } else {
    const values = data.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error("Decimal byte values must be integers from 0 to 255.");
    bytes = new Uint8Array(values);
  }
  closeModal();
  openFiles([new File([bytes.slice().buffer as ArrayBuffer], name, { type: "application/octet-stream", lastModified: Date.now() })]);
}

function showReplaceModal(): void {
  const tab = activeTab();
  if (!tab) return;
  showModal("Find and replace bytes", `<p>Replace all matches of a fixed-length hex pattern in the current effective byte stream.</p><label class="stack-label">Find hexadecimal bytes<input id="replaceFind" placeholder="DE AD BE EF"></label><label class="stack-label">Replace with equal-length bytes<input id="replaceWith" placeholder="00 00 00 00"></label><label class="checkbox-label"><input id="replaceConfirm" type="checkbox" checked> Ask before changing more than 100 matches</label><div class="modal-actions"><button data-modal-close>Cancel</button><button class="primary" data-modal-submit="replace">Find and Replace</button></div>`);
}

async function performReplace(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  const find = parseHexBytes(document.querySelector<HTMLInputElement>("#replaceFind")?.value ?? "");
  const replacement = parseHexBytes(document.querySelector<HTMLInputElement>("#replaceWith")?.value ?? "");
  if (find.length !== replacement.length) throw new Error("Find and replacement patterns must have equal byte lengths.");
  const file = currentEffectiveFile(tab);
  const results = await worker.search(file, { mode: "hex", value: [...find].map((value) => value.toString(16).padStart(2, "0")).join(" "), maxResults: MAX_REPLACE_RESULTS });
  if (!results.length) { closeModal(); toast("No matching byte pattern found."); return; }
  if (results.length > 100 && document.querySelector<HTMLInputElement>("#replaceConfirm")?.checked && !window.confirm(`Replace ${results.length.toLocaleString()} matches?`)) return;
  const changes: Array<{ offset: number; before: number | null; after: number | null }> = [];
  for (const result of results) {
    for (let index = 0; index < replacement.length; index += 1) {
      const offset = result.offset + index;
      const before = tab.patches.get(offset) ?? null;
      const after = replacement[index] ?? 0;
      tab.patches.set(offset, after);
      changes.push({ offset, before, after });
    }
  }
  recordPatch(tab, `Replace ${results.length} matches`, changes);
  closeModal();
  updateAll();
  toast(`Replaced ${results.length.toLocaleString()} match(es).`, "success");
}

async function runSearch(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  const mode = (document.querySelector<HTMLSelectElement>("#searchMode")?.value ?? "hex") as SearchQuery["mode"];
  const query: SearchQuery = {
    mode,
    value: document.querySelector<HTMLInputElement>("#searchValue")?.value ?? "",
    encoding: (document.querySelector<HTMLSelectElement>("#searchEncoding")?.value ?? "utf-8") as "utf-8" | "utf-16le" | "utf-16be",
    endian: (document.querySelector<HTMLSelectElement>("#searchEndian")?.value ?? "little") as "little" | "big",
    byteWidth: Number(document.querySelector<HTMLSelectElement>("#searchWidth")?.value ?? "4") as 1 | 2 | 4 | 8,
    caseSensitive: document.querySelector<HTMLInputElement>("#searchCase")?.checked ?? true,
    maxResults: Number(document.querySelector<HTMLInputElement>("#searchMax")?.value ?? "10000")
  };
  const button = document.querySelector<HTMLButtonElement>("[data-action='run-search']");
  if (button) { button.disabled = true; button.textContent = "Searching…"; }
  try {
    tab.searchResults = await worker.search(currentEffectiveFile(tab), query);
    renderForensicsView();
    toast(`${tab.searchResults.length.toLocaleString()} search result(s) found.`, "success");
  } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
}

async function compareWith(file: File): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  tab.compareFile = file;
  activeView = "comparison";
  renderViewTabs();
  renderComparisonView();
  try {
    tab.differences = await worker.compare(currentEffectiveFile(tab), file);
    renderComparisonView();
    toast(tab.differences.length ? `${tab.differences.length.toLocaleString()} difference range(s) found.` : "Files are identical.", "success");
  } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
}

async function exportSource(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;
  try {
    const start = parseOffset(document.querySelector<HTMLInputElement>("#sourceStart")?.value ?? "0");
    const length = Number.parseInt(document.querySelector<HTMLInputElement>("#sourceLength")?.value ?? "0", 10);
    if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid source export length.");
    if (length > MAX_SOURCE_EXPORT) throw new Error(`Source export is limited to ${formatBytes(MAX_SOURCE_EXPORT)} per operation.`);
    const bytes = await readRange(tab, start, Math.min(length, tab.file.size - start));
    const language = (document.querySelector<HTMLSelectElement>("#sourceLanguage")?.value ?? "c") as SourceLanguage;
    const variable = (document.querySelector<HTMLInputElement>("#sourceVariable")?.value ?? "binary_data").replace(/[^A-Za-z0-9_]/g, "_") || "binary_data";
    const code = exportAsSourceCode(bytes, language, variable);
    const extensions: Record<SourceLanguage, string> = { c: "c", cpp: "cpp", rust: "rs", python: "py", javascript: "js", typescript: "ts", java: "java", go: "go", csharp: "cs" };
    downloadBlob(new Blob([code], { type: "text/plain" }), `${variable}.${extensions[language]}`);
  } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportStringsCsv(tab: EditorTab): void {
  if (!tab.analysis) return;
  const rows = [["Offset", "Encoding", "Byte Length", "String"], ...tab.analysis.strings.map((item) => [formatOffset(item.offset), item.encoding, String(item.byteLength), item.value])];
  downloadBlob(new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")], { type: "text/csv" }), `${tab.file.name}.strings.csv`);
}

function exportIocsCsv(tab: EditorTab): void {
  if (!tab.analysis) return;
  const rows = [
    ["Offset", "Type", "Severity", "Value", "Note"],
    ...tab.analysis.iocs.items.map((item) => [formatOffset(item.offset), item.type, item.severity, item.value, item.note ?? ""])
  ];
  downloadBlob(new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")], { type: "text/csv" }), `${tab.file.name}.indicators.csv`);
}

function exportSignaturesCsv(tab: EditorTab): void {
  if (!tab.analysis) return;
  const rows = [["Offset", "Detected Marker", "Extensions", "Confidence"], ...tab.analysis.signatureHits.map((item) => [formatOffset(item.offset), item.name, item.extensions.join(" "), `${Math.round(item.confidence * 100)}%`])];
  downloadBlob(new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")], { type: "text/csv" }), `${tab.file.name}.signatures.csv`);
}

function updateBaseConverter(): void {
  const output = document.querySelector<HTMLOutputElement>("#baseOutput");
  if (!output) return;
  try {
    output.value = convertBase(document.querySelector<HTMLInputElement>("#baseValue")?.value ?? "", Number(document.querySelector<HTMLInputElement>("#baseFrom")?.value ?? "10"), Number(document.querySelector<HTMLInputElement>("#baseTo")?.value ?? "16"));
    output.classList.remove("error");
  } catch (error) {
    output.value = error instanceof Error ? error.message : String(error);
    output.classList.add("error");
  }
}

function syncReportMeta(tab: EditorTab): void {
  tab.notes = document.querySelector<HTMLTextAreaElement>("#reportNotes")?.value ?? tab.notes;
  tab.analyst = document.querySelector<HTMLInputElement>("#reportAnalyst")?.value ?? tab.analyst;
  tab.caseId = document.querySelector<HTMLInputElement>("#reportCaseId")?.value ?? tab.caseId;
  tab.evidenceNumber = document.querySelector<HTMLInputElement>("#reportEvidence")?.value ?? tab.evidenceNumber;
  tab.organization = document.querySelector<HTMLInputElement>("#reportOrganization")?.value ?? tab.organization;
  tab.acquisitionMethod = document.querySelector<HTMLInputElement>("#reportAcquisition")?.value ?? tab.acquisitionMethod;
  tab.classification = document.querySelector<HTMLInputElement>("#reportClassification")?.value ?? tab.classification;
  tab.includeHexExcerpt = document.querySelector<HTMLInputElement>("#reportHexExcerpt")?.checked ?? tab.includeHexExcerpt;
  tab.reportDetail = (document.querySelector<HTMLSelectElement>("#reportDetail")?.value ?? tab.reportDetail) as EditorTab["reportDetail"];
}

const REPORT_LIMITS = {
  summary: { strings: 120, signatures: 120, regions: 60, iocs: 120, capabilities: 80, excerpt: 256 },
  standard: { strings: 400, signatures: 250, regions: 150, iocs: 400, capabilities: 250, excerpt: 512 },
  full: { strings: 4000, signatures: 3000, regions: 1000, iocs: 3000, capabilities: 1500, excerpt: 1024 }
} as const;

async function generateReport(): Promise<void> {
  const tab = activeTab();
  if (!tab?.analysis) { toast("Wait for automatic analysis to complete.", "error"); return; }
  syncReportMeta(tab);
  const limits = REPORT_LIMITS[tab.reportDetail];

  // The excerpt is read on demand so the analysis payload never carries raw bytes.
  let hexExcerpt: { offset: number; bytes: number[] } | undefined;
  if (tab.includeHexExcerpt && tab.file.size > 0) {
    const bounds = selectionBounds(tab);
    const start = bounds && bounds.length > 1 ? bounds.start : Math.max(0, tab.cursor);
    const length = Math.min(limits.excerpt, tab.file.size - start, bounds && bounds.length > 1 ? bounds.length : limits.excerpt);
    hexExcerpt = { offset: start, bytes: [...await readRange(tab, start, length)] };
  }

  const button = document.querySelector<HTMLButtonElement>("[data-action='generate-report']");
  if (button) { button.disabled = true; button.textContent = "Building dossier…"; }
  try {
    savePdfReport(tab.analysis, {
      title: "Forensic Binary Analysis Dossier",
      userNotes: tab.notes,
      analystName: tab.analyst,
      caseId: tab.caseId,
      organization: tab.organization,
      evidenceNumber: tab.evidenceNumber,
      acquisitionMethod: tab.acquisitionMethod,
      classification: tab.classification,
      includeStrings: limits.strings,
      includeSignatures: limits.signatures,
      includeEntropyRegions: limits.regions,
      includeIocs: limits.iocs,
      includeCapabilities: limits.capabilities,
      hexExcerpt
    });
    toast("Forensic dossier generated.", "success");
  } catch (error) {
    toast(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    renderReportView();
  }
}

function refreshReportPreview(): void {
  const tab = activeTab();
  if (!tab) return;
  syncReportMeta(tab);
  const preview = document.querySelector<HTMLTextAreaElement>("#reportPreview");
  if (preview) preview.value = reportPreviewText(tab);
  toast("Report preview refreshed.", "success");
}

function focusSearch(): void {
  activeView = "forensics";
  updateAll();
  window.setTimeout(() => {
    document.querySelector<HTMLInputElement>("#searchValue")?.focus();
    document.querySelector("#advancedSearch")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function goToPrompt(): void {
  const tab = activeTab();
  if (!tab) return;
  const entered = window.prompt("Go to offset (decimal or 0x hexadecimal):", formatOffset(tab.cursor));
  if (!entered) return;
  try { setCursor(parseOffset(entered)); } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
}

function handleCommand(command: string): void {
  const tab = activeTab();
  if (command === "new") showNewFileModal();
  else if (command === "open") fileInput.click();
  else if (command === "import") showImportModal();
  else if (command === "save") saveCurrent(false);
  else if (command === "saveas") saveCurrent(true);
  else if (command === "export-selection") void exportSelection();
  else if (command === "undo") undo();
  else if (command === "redo") redo();
  else if (command === "find") focusSearch();
  else if (command === "replace") showReplaceModal();
  else if (command === "goto") goToPrompt();
  else if (command === "insert") void insertBytes();
  else if (command === "delete") void deleteSelection();
  else if (command === "intel") { activeView = "intel"; updateAll(); }
  else if (command === "forensics") { activeView = "forensics"; updateAll(); }
  else if (command === "compare") { activeView = "comparison"; updateAll(); }
  else if (command === "report") { activeView = "report"; updateAll(); }
  else if (tab) updateAll();
}

let listenersRegistered = false;

/** Bound once per page load; re-entering the app route reuses the same handlers. */
function registerListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const closeId = target.closest<HTMLElement>("[data-close-tab]")?.dataset.closeTab;
  if (closeId) { event.stopPropagation(); closeTab(closeId); return; }
  const tabId = target.closest<HTMLElement>("[data-tab-id]")?.dataset.tabId;
  if (tabId) { activateTab(tabId); return; }
  const command = target.closest<HTMLButtonElement>("[data-command]")?.dataset.command;
  if (command) { handleCommand(command); return; }
  const view = target.closest<HTMLButtonElement>("[data-view]")?.dataset.view as MainView | undefined;
  if (view) { activeView = view; updateAll(); return; }
  // --- inline byte editor -------------------------------------------------------
  // Handled before the generic byte-offset branch: these controls live inside the
  // grid, and a bit switch must not be mistaken for a click on a byte cell.
  const bitButton = target.closest<HTMLElement>("[data-bit]");
  if (bitButton) {
    const tabNow = activeTab();
    const bitIndex = Number(bitButton.dataset.bit);
    if (tabNow && Number.isInteger(bitIndex)) void writeForgeByte(tabNow, (current) => toggleBit(current, bitIndex), `Flip bit ${bitIndex}`);
    return;
  }

  const nibbleStep = target.closest<HTMLElement>("[data-nibble-step]")?.dataset.nibbleStep;
  if (nibbleStep) {
    const tabNow = activeTab();
    const [which, deltaText] = nibbleStep.split(":");
    const delta = Number(deltaText);
    if (tabNow) {
      void writeForgeByte(tabNow, (current) => {
        if (which === "hi") {
          const high = ((current >> 4) + delta + 16) % 16;
          return (high << 4) | (current & 0x0F);
        }
        const low = ((current & 0x0F) + delta + 16) % 16;
        return (current & 0xF0) | low;
      }, `Step ${which} nibble`);
    }
    return;
  }

  const forgeAction = target.closest<HTMLElement>("[data-action^='forge-']")?.dataset.action;
  if (forgeAction) {
    const tabNow = activeTab();
    if (!tabNow) return;
    if (forgeAction === "forge-invert") void writeForgeByte(tabNow, (current) => current ^ 0xFF, "Invert byte");
    else if (forgeAction === "forge-revert") void revertForgeByte(tabNow);
    else if (forgeAction === "forge-next") { tabNow.nibble = 0; setCursor(tabNow.cursor + 1); }
    return;
  }

  if (target.closest("[data-action='toggle-wide']")) {
    wideView = !wideView;
    updateAll();
    // Row geometry depends on the grid width, so re-measure after the layout settles.
    window.requestAnimationFrame(() => { hexRowHeightCache = 0; renderHexView(); });
    return;
  }

  const byteOffset = target.closest<HTMLElement>("[data-byte-offset]")?.dataset.byteOffset;
  if (byteOffset !== undefined) { setCursor(Number(byteOffset), (event as MouseEvent).shiftKey, false); return; }
  const jump = target.closest<HTMLElement>("[data-jump]")?.dataset.jump;
  if (jump !== undefined) { activeView = "hex"; setCursor(Number(jump)); return; }
  const iocFilter = target.closest<HTMLButtonElement>("[data-ioc-filter]")?.dataset.iocFilter;
  if (iocFilter) {
    const tab = activeTab();
    if (tab?.analysis) {
      tab.iocFilter = iocFilter as IocType | "all";
      const table = document.querySelector<HTMLDivElement>("#iocTable");
      if (table) table.innerHTML = renderIocTable(tab.analysis, tab.iocFilter);
      document.querySelectorAll<HTMLButtonElement>("[data-ioc-filter]").forEach((button) => button.classList.toggle("active", button.dataset.iocFilter === iocFilter));
    }
    return;
  }
  const copy = target.closest<HTMLElement>("[data-copy]")?.dataset.copy;
  if (copy) { void navigator.clipboard.writeText(copy).then(() => toast("Copied.", "success")); return; }
  const inputMode = target.closest<HTMLButtonElement>("[data-input-mode]")?.dataset.inputMode as InputMode | undefined;
  if (inputMode) { const tab = activeTab(); if (tab) { tab.inputMode = inputMode; updateAll(); } return; }
  if (target.closest("[data-modal-close]")) { closeModal(); return; }
  const submit = target.closest<HTMLButtonElement>("[data-modal-submit]")?.dataset.modalSubmit;
  if (submit) {
    try {
      if (submit === "new") createNewFile();
      else if (submit === "import") importData();
      else if (submit === "insert") void performInsert().catch((error) => toast(error instanceof Error ? error.message : String(error), "error"));
      else if (submit === "replace") void performReplace().catch((error) => toast(error instanceof Error ? error.message : String(error), "error"));
    } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
    return;
  }
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  const tab = activeTab();
  if (!action) return;
  if (action === "previous-page" && tab) { const page = Math.max(0, tab.page - 1); setCursor(Math.min(Math.max(0, tab.file.size - 1), page * tab.pageSize)); }
  else if (action === "next-page" && tab) { const totalPages = Math.max(1, Math.ceil(tab.file.size / tab.pageSize)); const page = Math.min(totalPages - 1, tab.page + 1); setCursor(Math.min(Math.max(0, tab.file.size - 1), page * tab.pageSize)); }
  else if (action === "copy-hex") void copySelection(false);
  else if (action === "copy-text") void copySelection(true);
  else if (action === "save-selection") void exportSelection();
  else if (action === "select-all" && tab?.file.size) { tab.selectionStart = 0; tab.selectionEnd = tab.file.size - 1; tab.cursor = 0; tab.page = 0; updateAll(); }
  else if (action === "fill-00") void bulkSelectionOperation("fill00");
  else if (action === "fill-ff") void bulkSelectionOperation("fillff");
  else if (action === "invert") void bulkSelectionOperation("invert");
  else if (action === "random") void bulkSelectionOperation("random");
  else if (action === "reanalyze" && tab) void analyze(tab);
  else if (action === "copy-hashes" && tab?.analysis) void navigator.clipboard.writeText(tab.analysis.hashes.map((hash) => `${hash.algorithm}: ${hash.value}`).join("\n")).then(() => toast("Hashes copied.", "success"));
  else if (action === "run-search") void runSearch();
  else if (action === "export-strings" && tab) exportStringsCsv(tab);
  else if (action === "export-signatures" && tab) exportSignaturesCsv(tab);
  else if (action === "export-iocs" && tab) exportIocsCsv(tab);
  else if (action === "toggle-theme") { theme = toggleTheme(theme); toast(`Switched to the ${theme} console theme.`, "success"); }
  else if (action === "export-source") void exportSource();
  else if (action === "choose-compare") compareInput.click();
  else if (action === "run-tab-compare" && tab) { const selected = document.querySelector<HTMLSelectElement>("#compareTabSelect")?.value; const other = tabs.find((item) => item.id === selected); if (other) void compareWith(currentEffectiveFile(other)); else toast("Choose another open tab or load an external comparison file.", "error"); }
  else if (action === "previous-difference" && tab?.differences.length) { const previous = [...tab.differences].reverse().find((item) => item.offset < tab.cursor) ?? tab.differences.at(-1); if (previous) setCursor(previous.offset); }
  else if (action === "next-difference" && tab?.differences.length) { const next = tab.differences.find((item) => item.offset > tab.cursor) ?? tab.differences[0]; if (next) setCursor(next.offset); }
  else if (action === "generate-report") void generateReport();
  else if (action === "refresh-report") refreshReportPreview();
});

app.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (["baseValue", "baseFrom", "baseTo"].includes(target.id)) updateBaseConverter();
  if (target.id === "stringFilter") {
    const tab = activeTab();
    const results = document.querySelector<HTMLDivElement>("#stringResults");
    if (tab?.analysis && results) results.innerHTML = renderStrings(tab.analysis, target.value);
  }
  if (target.id.startsWith("report")) {
    const tab = activeTab();
    if (tab) syncReportMeta(tab);
  }
});

app.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  const tab = activeTab();
  if (target.id === "pageSizeSelect" && tab) { tab.pageSize = Number(target.value); tab.page = Math.floor(tab.cursor / tab.pageSize); updateAll(); return; }
  if (target.id === "bytesPerRowSelect") { bytesPerRow = Number(target.value); if (tab) { tab.hexScrollTop = 0; tab.hexScrollLeft = 0; } renderHexView(); return; }
  if (target.dataset.nibble) {
    const tabNow = activeTab();
    const digit = target.value.trim().toLowerCase();
    if (tabNow && /^[0-9a-f]$/.test(digit)) {
      const nibbleValue = Number.parseInt(digit, 16);
      const high = target.dataset.nibble === "hi";
      void writeForgeByte(tabNow, (current) => high ? ((nibbleValue << 4) | (current & 0x0F)) : ((current & 0xF0) | nibbleValue), "Edit nibble");
    } else {
      updateAll();
    }
    return;
  }
  if (target.id === "byteHexInput") {
    const tabNow = activeTab();
    const text = target.value.trim();
    if (tabNow && /^[0-9a-f]{1,2}$/i.test(text)) void writeForgeByte(tabNow, () => Number.parseInt(text, 16), "Edit byte");
    else void refreshForgePanel(tabNow ?? null);
    return;
  }
  if (target.id === "characterModeSelect") { characterMode = target.value as typeof characterMode; renderHexView(); return; }
  if (target.matches("[data-bit]") && tab) {
    const bit = Number((target as HTMLInputElement).dataset.bit);
    void readByte(tab, tab.cursor).then((byte) => {
      const before = tab.patches.get(tab.cursor) ?? null;
      const after = setBit(byte, bit, (target as HTMLInputElement).checked);
      tab.patches.set(tab.cursor, after);
      recordPatch(tab, "Edit bit", [{ offset: tab.cursor, before, after }]);
      updateAll();
    });
  }
});

app.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  const tab = activeTab();
  if (event.key === "Escape" && !modalBackdrop.classList.contains("hidden")) { closeModal(); return; }
  if (event.key === "Enter") {
    if (target.matches("[data-inspector-offset]") && tab) { try { setCursor(parseOffset((target as HTMLInputElement).value)); } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); } }
    else if (target.matches("[data-inspector-byte]") && tab) {
      const text = (target as HTMLInputElement).value;
      if (/^[0-9a-f]{1,2}$/i.test(text)) setBytes(tab, tab.cursor, new Uint8Array([Number.parseInt(text, 16)]), "Edit byte");
      else toast("Enter one hexadecimal byte.", "error");
    } else if (target.id === "binaryByteInput" && tab) {
      try { setBytes(tab, tab.cursor, new Uint8Array([bitsToByte((target as HTMLInputElement).value)]), "Edit binary byte"); } catch (error) { toast(error instanceof Error ? error.message : String(error), "error"); }
    }
  }
  // Accept keys from anywhere inside the grid. Byte cells are buttons, so after a click
  // the event target is the cell rather than the grid itself; comparing the id directly
  // swallowed every keystroke and made editing look unavailable.
  const grid = document.querySelector<HTMLElement>("#hexGrid");
  if (!grid || !(target === grid || grid.contains(target))) return;
  if (!tab || tab.file.size === 0) return;

  const rowStart = Math.floor(tab.cursor / bytesPerRow) * bytesPerRow;
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -bytesPerRow, ArrowDown: bytesPerRow, PageUp: -tab.pageSize, PageDown: tab.pageSize };
  if (event.key in moves) { event.preventDefault(); tab.nibble = 0; setCursor(tab.cursor + (moves[event.key] ?? 0), event.shiftKey); return; }
  if (event.key === "Home") { event.preventDefault(); tab.nibble = 0; setCursor(event.ctrlKey ? 0 : rowStart, event.shiftKey); return; }
  if (event.key === "End") { event.preventDefault(); tab.nibble = 0; setCursor(event.ctrlKey ? tab.file.size - 1 : Math.min(tab.file.size - 1, rowStart + bytesPerRow - 1), event.shiftKey); return; }
  if (event.key === "w" || event.key === "W") {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      wideView = !wideView;
      updateAll();
      window.requestAnimationFrame(() => { hexRowHeightCache = 0; renderHexView(); });
      return;
    }
  }
  if (event.key === "Tab") { event.preventDefault(); tab.nibble = 0; tab.inputMode = tab.inputMode === "hex" ? "text" : "hex"; updateAll(); return; }
  if (event.key === "Escape") { tab.nibble = 0; void repaintByte(tab, tab.cursor); return; }

  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    const offset = event.key === "Backspace" ? tab.cursor - 1 : tab.cursor;
    if (offset < 0 || offset >= tab.file.size) return;
    const before = tab.patches.get(offset) ?? null;
    tab.patches.set(offset, 0);
    recordPatch(tab, "Zero byte", [{ offset, before, after: 0 }]);
    tab.nibble = 0;
    if (event.key === "Backspace") setCursor(offset);
    else { void repaintByte(tab, offset); updateStatusOnly(); }
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (tab.inputMode === "hex" && /^[0-9a-f]$/i.test(event.key)) {
    event.preventDefault();
    const nibbleValue = Number.parseInt(event.key, 16);
    const offset = tab.cursor;
    const highNibble = tab.nibble === 0;
    editQueue = editQueue.then(async () => {
      // Read through the patch overlay so the second keystroke composes onto the value
      // the first one wrote rather than the original file byte.
      const current = await readByte(tab, offset);
      const before = tab.patches.get(offset) ?? null;
      const after = highNibble ? ((nibbleValue << 4) | (current & 0x0F)) : ((current & 0xF0) | nibbleValue);
      tab.patches.set(offset, after);
      recordPatch(tab, highNibble ? "Edit high nibble" : "Edit low nibble", [{ offset, before, after }]);
      if (highNibble) {
        tab.nibble = 1;
        // Repaint only this cell. A full re-render rebuilds the grid and drops focus,
        // so the low-nibble keystroke would never reach this handler.
        await repaintByte(tab, offset);
        updateStatusOnly();
      } else {
        tab.nibble = 0;
        setCursor(offset + 1);
      }
    });
    return;
  }

  if (tab.inputMode === "text" && event.key.length === 1) {
    const code = event.key.charCodeAt(0);
    if (code > 0xFF) return;
    event.preventDefault();
    const offset = tab.cursor;
    const before = tab.patches.get(offset) ?? null;
    tab.patches.set(offset, code);
    recordPatch(tab, "Edit text byte", [{ offset, before, after: code }]);
    tab.nibble = 0;
    setCursor(offset + 1);
  }
});

window.addEventListener("keydown", (event) => {
  const ctrl = event.ctrlKey || event.metaKey;
  if (!ctrl) return;
  const key = event.key.toLowerCase();
  if (key === "o") { event.preventDefault(); fileInput.click(); }
  else if (key === "s") { event.preventDefault(); saveCurrent(event.shiftKey); }
  else if (key === "f") { event.preventDefault(); focusSearch(); }
  else if (key === "h") { event.preventDefault(); showReplaceModal(); }
  else if (key === "g") { event.preventDefault(); goToPrompt(); }
  else if (key === "z") { event.preventDefault(); undo(); }
  else if (key === "y") { event.preventDefault(); redo(); }
  else if (key === "a" && activeTab()) { event.preventDefault(); const tab = activeTab(); if (tab?.file.size) { tab.selectionStart = 0; tab.selectionEnd = tab.file.size - 1; tab.cursor = 0; tab.page = 0; updateAll(); } }
});

window.addEventListener("dragenter", (event) => { event.preventDefault(); dragDepth += 1; $("#dropOverlay").classList.add("visible"); });
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("dragleave", (event) => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) $("#dropOverlay").classList.remove("visible"); });
window.addEventListener("drop", (event) => { event.preventDefault(); dragDepth = 0; $("#dropOverlay").classList.remove("visible"); openFiles(Array.from(event.dataTransfer?.files ?? [])); });
window.addEventListener("beforeunload", () => { worker.terminate(); for (const tab of tabs) tab.preview?.revoke(); });

}

// Keep the PDF module included in the optimized build.
void buildPdfReport;

/** Builds the workstation shell into `root` and wires it up. Called once by the router. */
export function mountWorkstation(root: HTMLDivElement): void {
  app = root;
  app.innerHTML = SHELL_HTML;

  viewContent = $("#viewContent") as HTMLDivElement;
  workspaceTabs = $("#workspaceTabs") as HTMLDivElement;
  fileInput = $("#fileInput") as HTMLInputElement;
  compareInput = $("#compareInput") as HTMLInputElement;
  pageSizeSelect = $("#pageSizeSelect") as HTMLSelectElement;
  modalBackdrop = $("#modalBackdrop") as HTMLDivElement;
  modal = $("#modal") as HTMLDivElement;

  // Bound per mount, not inside registerListeners(). The shell is rebuilt on every
  // mount, so these are fresh elements each time; the once-only guard would leave the
  // listeners attached to the discarded inputs and silently break Open after the user
  // navigated back to the landing and returned.
  fileInput.addEventListener("change", () => {
    openFiles(Array.from(fileInput.files ?? []));
    fileInput.value = "";
  });
  compareInput.addEventListener("change", () => {
    const file = compareInput.files?.[0];
    if (file) void compareWith(file);
    compareInput.value = "";
  });

  registerListeners();
  updateAll();
}

/**
 * Rebuilds the shell when the user navigates back to the app route.
 * Open tabs live in module state, so re-rendering restores the previous session.
 */
export function remountWorkstation(root: HTMLDivElement): void {
  mountWorkstation(root);
}


/**
 * Applies a transform to the byte under the cursor and repaints in place.
 *
 * Every inline-editor control routes through here so bit flips, nibble dials, and the
 * action buttons all produce one undo entry each and share the same repaint path. A
 * full re-render would rebuild the grid and close the editor mid-interaction.
 */
async function writeForgeByte(tab: EditorTab, transform: (current: number) => number, label: string): Promise<void> {
  const offset = tab.cursor;
  const current = await readByte(tab, offset);
  const next = transform(current) & 0xFF;
  if (next === current) return;
  const before = tab.patches.get(offset) ?? null;
  tab.patches.set(offset, next);
  recordPatch(tab, label, [{ offset, before, after: next }]);
  tab.nibble = 0;
  await repaintByte(tab, offset);
  void refreshForgePanel(tab);
  updateStatusOnly();
}

/** Restores the byte on disk, dropping its patch entirely. */
async function revertForgeByte(tab: EditorTab): Promise<void> {
  const offset = tab.cursor;
  const before = tab.patches.get(offset) ?? null;
  if (before === null) return;
  const original = (await tab.source.read(offset, 1))[0] ?? 0;
  tab.patches.delete(offset);
  recordPatch(tab, "Revert byte", [{ offset, before, after: null }]);
  await repaintByte(tab, offset);
  void refreshForgePanel(tab);
  updateStatusOnly();
}

/**
 * Renders the rail byte editor for the current cursor.
 *
 * Called whenever the cursor or the byte under it changes. It never touches the grid,
 * so editing from the rail cannot disturb scroll position or selection.
 */
async function refreshForgePanel(tab: EditorTab | null): Promise<void> {
  const host = document.querySelector<HTMLElement>("#byteForge");
  if (!host) return;
  if (!tab || tab.file.size === 0) { host.innerHTML = renderByteForge(null); return; }

  const offset = tab.cursor;
  const value = await readByte(tab, offset);
  const original = (await tab.source.read(offset, 1))[0] ?? value;
  if (tab.id !== activeId || tab.cursor !== offset) return;
  host.innerHTML = renderByteForge({ offset, value, original, hasPatch: tab.patches.has(offset) });
}


/**
 * Returns the requested span with patches applied, if the cached read covers it.
 * Returns null when a fresh read is needed, so callers can choose to await.
 */
function cachedSlice(tab: EditorTab, offset: number, length: number): Uint8Array | null {
  const cache = tab.readCache;
  if (!cache || length <= 0) return length <= 0 ? new Uint8Array() : null;
  if (offset < cache.start || offset + length > cache.start + cache.bytes.length) return null;
  const view = cache.bytes.slice(offset - cache.start, offset - cache.start + length);
  applyPatchOverlay(tab, view, offset);
  return view;
}

/**
 * Reads a span padded well beyond the visible window and caches the raw bytes, so
 * subsequent scrolling nearby is served without touching the file again.
 */
async function fillReadCache(tab: EditorTab, offset: number, length: number): Promise<Uint8Array> {
  if (length <= 0) return new Uint8Array();
  const margin = HEX_CACHE_MARGIN_ROWS * bytesPerRow;
  const start = Math.max(0, offset - margin);
  const end = Math.min(tab.file.size, offset + length + margin);
  const raw = await tab.source.read(start, end - start);
  tab.readCache = { start, bytes: raw };
  const view = raw.slice(offset - start, offset - start + length);
  applyPatchOverlay(tab, view, offset);
  return view;
}

/** Layers edited bytes over a raw span. The cache deliberately stores unpatched data. */
function applyPatchOverlay(tab: EditorTab, view: Uint8Array, offset: number): void {
  if (tab.patches.size === 0) return;
  for (const [patchOffset, value] of tab.patches) {
    if (patchOffset >= offset && patchOffset < offset + view.length) view[patchOffset - offset] = value;
  }
}

/** Drops the cache when the underlying bytes change. */
function invalidateReadCache(tab: EditorTab): void {
  tab.readCache = undefined;
}
