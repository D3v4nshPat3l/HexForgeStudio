import { ENCODINGS, PAYLOAD_CATEGORIES, payloadCount, type EncodingId, type PayloadCategoryId } from "../analyzers/payloads";

/**
 * Payload injector view.
 *
 * Writes a selected test payload into the open buffer at a chosen position, optionally
 * encoded. Every write goes through the editor's normal patch and undo machinery, so an
 * injection is reversible like any other edit and nothing touches the file on disk until
 * the user saves.
 *
 * The library is a starting point, not a constraint: the source box is editable, and
 * anything typed there is what gets encoded and written. Selecting a library entry
 * loads it into that box rather than bypassing it, so there is one source of truth for
 * what will be injected.
 */

export type InjectMode = "overwrite-cursor" | "insert-cursor" | "overwrite-selection" | "append" | "offset";

export interface InjectorState {
  category: PayloadCategoryId;
  payloadIndex: number;
  encoding: EncodingId;
  mode: InjectMode;
  /** Target for the explicit-offset mode, as typed. */
  offsetText: string;
  /** Substitutions applied before encoding, for placeholder-bearing payloads. */
  host: string;
  port: string;
  repeat: number;
  nullTerminate: boolean;
  /**
   * The text that will actually be injected. Seeded from the selected library entry
   * and then freely editable; `edited` tracks whether it still matches the library.
   */
  source: string;
  edited: boolean;
}

export const DEFAULT_INJECTOR_STATE: InjectorState = {
  category: "sqli",
  payloadIndex: 0,
  encoding: "raw",
  mode: "overwrite-cursor",
  offsetText: "0x00000000",
  host: "127.0.0.1",
  port: "4444",
  repeat: 1,
  nullTerminate: false,
  source: PAYLOAD_CATEGORIES[0]?.payloads[0]?.value ?? "",
  edited: false
};

const MODES: Array<{ id: InjectMode; label: string; note: string }> = [
  { id: "overwrite-cursor", label: "Overwrite at cursor", note: "Replaces bytes from the cursor onward; file size unchanged" },
  { id: "insert-cursor", label: "Insert at cursor", note: "Shifts the remainder of the file right; size grows" },
  { id: "overwrite-selection", label: "Overwrite selection", note: "Fills the current selection, truncating to fit" },
  { id: "offset", label: "Insert at offset", note: "Inserts at a specific offset you type" },
  { id: "append", label: "Append to end", note: "Adds to the tail of the file" }
];

export function lookupPayload(category: PayloadCategoryId, index: number): string {
  const group = PAYLOAD_CATEGORIES.find((item) => item.id === category) ?? PAYLOAD_CATEGORIES[0]!;
  return group.payloads[Math.min(index, group.payloads.length - 1)]?.value ?? "";
}

export interface InjectorRenderInput {
  state: InjectorState;
  hasFile: boolean;
  cursor: number;
  selectionLength: number;
  fileSize: number;
  /** Bytes that would be written, for the preview. */
  preview: Uint8Array;
}

export function renderInjectorView(input: InjectorRenderInput): string {
  const { state, hasFile, cursor, selectionLength, fileSize, preview } = input;
  const category = PAYLOAD_CATEGORIES.find((item) => item.id === state.category) ?? PAYLOAD_CATEGORIES[0]!;
  const mode = MODES.find((item) => item.id === state.mode) ?? MODES[0]!;
  const usesPlaceholders = /LISTENER_HOST|LISTENER_PORT/.test(state.source);

  const hexPreview = [...preview.slice(0, 512)]
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
  const textPreview = [...preview.slice(0, 512)]
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "."))
    .join("");

  return `<div class="content-scroll injector-view">
    <section class="content-card">
      <div class="card-heading">
        <h3>PAYLOAD LIBRARY</h3>
        <span>${PAYLOAD_CATEGORIES.length} categories · ${payloadCount()} payloads</span>
      </div>
      <p>
        Pick an entry to load it into the source box below, or write your own. Whatever is
        in that box is what gets encoded and written.
      </p>

      <div class="payload-browser">
        <div class="payload-categories" role="tablist" aria-label="Payload categories">
          ${PAYLOAD_CATEGORIES.map((item) => `
            <button type="button" class="payload-cat${item.id === state.category ? " active" : ""}"
              data-payload-category="${item.id}" role="tab" aria-selected="${item.id === state.category}">
              <b>${escapeHtml(item.label)}</b><span>${item.payloads.length}</span>
            </button>`).join("")}
        </div>

        <div class="payload-list" role="listbox" aria-label="${escapeHtml(category.label)} payloads">
          <p class="payload-summary">${escapeHtml(category.summary)}</p>
          ${category.payloads.map((item, index) => {
            const selected = !state.edited && index === state.payloadIndex;
            return `<button type="button" class="payload-item${selected ? " active" : ""}"
              data-payload-index="${index}" role="option" aria-selected="${selected}">
              <b>${escapeHtml(item.name)}</b>
              <code>${escapeHtml(item.value.length > 96 ? `${item.value.slice(0, 96)}…` : item.value)}</code>
              <small>${escapeHtml(item.note)}</small>
            </button>`;
          }).join("")}
        </div>
      </div>
    </section>

    <section class="content-card">
      <div class="card-heading">
        <h3>SOURCE${state.edited ? " · CUSTOM" : ""}</h3>
        <span>${state.source.length.toLocaleString()} characters</span>
      </div>
      <p>
        Editable. Escapes <code>\\xNN</code>, <code>\\n</code>, <code>\\r</code> and <code>\\t</code>
        are expanded before encoding.
      </p>
      <textarea id="injSource" class="injector-source" spellcheck="false" rows="4"
        placeholder="Type or paste a payload…">${escapeHtml(state.source)}</textarea>
      <div class="injector-source-actions">
        <button data-action="inject-reset"${state.edited ? "" : " disabled"}>Reset to library entry</button>
        <button data-action="inject-clear">Clear</button>
      </div>
    </section>

    <section class="content-card">
      <div class="card-heading"><h3>DELIVERY</h3></div>
      <div class="injector-grid">
        <label>Encoding
          <select id="injEncoding">
            ${ENCODINGS.map((item) =>
              `<option value="${item.id}"${item.id === state.encoding ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </label>
        <label>Position
          <select id="injMode">
            ${MODES.map((item) =>
              `<option value="${item.id}"${item.id === state.mode ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </label>
        <label>Offset${state.mode === "offset" ? "" : " (unused)"}
          <input id="injOffset" value="${escapeHtml(state.offsetText)}" spellcheck="false"${state.mode === "offset" ? "" : " disabled"}>
        </label>
        <label>Repeat
          <input id="injRepeat" type="number" min="1" max="4096" value="${state.repeat}">
        </label>
        ${usesPlaceholders ? `
        <label>LISTENER_HOST<input id="injHost" value="${escapeHtml(state.host)}" spellcheck="false"></label>
        <label>LISTENER_PORT<input id="injPort" value="${escapeHtml(state.port)}" spellcheck="false"></label>` : ""}
      </div>

      <div class="injector-detail">
        <div><span>Position</span><b>${escapeHtml(mode.note)}</b></div>
        <div><span>Encoding</span><b>${escapeHtml(ENCODINGS.find((item) => item.id === state.encoding)?.note ?? "")}</b></div>
      </div>

      <label class="checkbox-label"><input type="checkbox" id="injNull"${state.nullTerminate ? " checked" : ""}>Append a null terminator</label>
    </section>

    <section class="content-card">
      <div class="card-heading">
        <h3>BYTES TO BE WRITTEN</h3>
        <span>${preview.length.toLocaleString()} bytes${preview.length > 512 ? " · first 512 shown" : ""}</span>
      </div>
      <pre class="injector-preview mono">${escapeHtml(hexPreview) || "—"}</pre>
      <pre class="injector-preview mono">${escapeHtml(textPreview) || "—"}</pre>

      <div class="injector-actions">
        <span>${hasFile
          ? `Cursor ${formatOffset(cursor)} · selection ${selectionLength.toLocaleString()} bytes · file ${fileSize.toLocaleString()} bytes`
          : "Open a file to enable injection."}</span>
        <div>
          <button data-action="inject-copy"${hasFile ? "" : " disabled"}>Copy Bytes</button>
          <button class="primary" data-action="inject-apply"${hasFile ? "" : " disabled"}>Inject</button>
        </div>
      </div>
    </section>

    <section class="content-card injector-scope">
      <b>Scope.</b> This writes into the file you have open, on your own machine. Use it against
      systems and artifacts you own or are authorized to test. The application does not execute
      payloads, does not open network connections, and sends nothing anywhere.
    </section>
  </div>`;
}

function formatOffset(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
