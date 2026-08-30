import { ENCODINGS, type EncodingId } from "../analyzers/payloads";
import {
  categoryTotal, filterPayloads, libraryError, libraryStatus, libraryTotals, loadedLibrary
} from "../analyzers/payload-library";
import {
  LISTENERS, REVERSE_SHELLS, SHELL_BINARIES, TTY_UPGRADES, renderTemplate
} from "../analyzers/reverse-shells";

/**
 * Payload injector view.
 *
 * Browses the bundled library (category, then document, then payload), loads a choice
 * into an editable source box, encodes it, and writes it into the open buffer at a
 * chosen position. Writes go through the editor's normal patch and undo machinery.
 *
 * The library holds tens of thousands of entries, so the payload column is filtered and
 * capped rather than fully rendered -- one upstream document alone carries over twenty
 * thousand lines, and putting that in the DOM would stall the tab.
 *
 * Payload text is only ever displayed, encoded, and written. It is never evaluated.
 */

export type InjectMode = "overwrite-cursor" | "insert-cursor" | "overwrite-selection" | "append" | "offset";

/** Payload rows rendered at once; the rest stay behind the filter. */
export const PAYLOAD_RENDER_LIMIT = 300;

export interface InjectorState {
  categoryIndex: number;
  groupIndex: number;
  payloadKey: string;
  query: string;
  encoding: EncodingId;
  mode: InjectMode;
  offsetText: string;
  host: string;
  port: string;
  repeat: number;
  nullTerminate: boolean;
  /** What will actually be injected: seeded from a selection, then freely editable. */
  source: string;
  edited: boolean;
  /** Which builder is showing: the payload library or the connect-back generator. */
  tool: "library" | "shell";
  shellBinary: string;
  shellPlatform: "All" | "Linux" | "Windows" | "Any";
}

export const DEFAULT_INJECTOR_STATE: InjectorState = {
  categoryIndex: 0,
  groupIndex: 0,
  payloadKey: "",
  query: "",
  encoding: "raw",
  mode: "overwrite-cursor",
  offsetText: "0x00000000",
  host: "127.0.0.1",
  port: "4444",
  repeat: 1,
  nullTerminate: false,
  source: "",
  edited: false,
  tool: "library",
  shellBinary: "/bin/sh",
  shellPlatform: "All"
};

const MODES: Array<{ id: InjectMode; label: string; note: string }> = [
  { id: "overwrite-cursor", label: "Overwrite at cursor", note: "Replaces bytes from the cursor onward; file size unchanged" },
  { id: "insert-cursor", label: "Insert at cursor", note: "Shifts the remainder of the file right; size grows" },
  { id: "overwrite-selection", label: "Overwrite selection", note: "Fills the current selection, truncating to fit" },
  { id: "offset", label: "Insert at offset", note: "Inserts at a specific offset you type" },
  { id: "append", label: "Append to end", note: "Adds to the tail of the file" }
];

export interface InjectorRenderInput {
  state: InjectorState;
  hasFile: boolean;
  cursor: number;
  selectionLength: number;
  fileSize: number;
  preview: Uint8Array;
}

export function renderInjectorView(input: InjectorRenderInput): string {
  const { state, hasFile, cursor, selectionLength, fileSize, preview } = input;
  const mode = MODES.find((item) => item.id === state.mode) ?? MODES[0]!;
  const usesPlaceholders = /LISTENER_HOST|LISTENER_PORT/.test(state.source);

  const hexPreview = [...preview.slice(0, 512)]
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
  const textPreview = [...preview.slice(0, 512)]
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "."))
    .join("");

  return `<div class="content-scroll injector-view">
    <div class="tool-switch" role="tablist" aria-label="Payload source">
      <button type="button" class="${state.tool === "library" ? "active" : ""}" data-injector-tool="library" role="tab"
        aria-selected="${state.tool === "library"}">Payload library</button>
      <button type="button" class="${state.tool === "shell" ? "active" : ""}" data-injector-tool="shell" role="tab"
        aria-selected="${state.tool === "shell"}">Connect-back builder</button>
    </div>

    ${state.tool === "library" ? renderBrowser(state) : renderShellBuilder(state)}

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
        placeholder="Pick a payload above, or type your own…">${escapeHtml(state.source)}</textarea>
      <div class="injector-source-actions">
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

/**
 * Connect-back command builder.
 *
 * Host, port and shell are substituted into each template live, so the commands read
 * exactly as they would be used. Selecting one loads it into the source box; it is
 * never run here.
 */
function renderShellBuilder(state: InjectorState): string {
  const options = { host: state.host, port: state.port, shell: state.shellBinary };
  const platforms: Array<InjectorState["shellPlatform"]> = ["All", "Linux", "Windows", "Any"];
  const visible = REVERSE_SHELLS.filter((item) =>
    state.shellPlatform === "All" || item.platform === state.shellPlatform);

  const row = (id: string, label: string, note: string, command: string) => `
    <button type="button" class="payload-item shell-item" data-payload-value="${escapeHtml(command)}" data-shell-id="${id}">
      <span class="shell-item-head"><b>${escapeHtml(label)}</b><em>${escapeHtml(note)}</em></span>
      <code>${escapeHtml(command)}</code>
    </button>`;

  return `<section class="content-card">
    <div class="card-heading">
      <h3>CONNECT-BACK BUILDER</h3>
      <span>${REVERSE_SHELLS.length} callbacks · ${LISTENERS.length} listeners</span>
    </div>
    <p>
      Host, port and shell are substituted into each template as you type. Selecting a
      command loads it into the source box below. Nothing here is executed, and this
      application opens no network connections.
    </p>

    <div class="injector-grid">
      <label>Listener host<input id="injHost" value="${escapeHtml(state.host)}" spellcheck="false"></label>
      <label>Listener port<input id="injPort" value="${escapeHtml(state.port)}" spellcheck="false"></label>
      <label>Shell
        <select id="injShellBinary">
          ${SHELL_BINARIES.map((item) =>
            `<option value="${escapeHtml(item)}"${item === state.shellBinary ? " selected" : ""}>${escapeHtml(item)}</option>`).join("")}
        </select>
      </label>
      <label>Platform
        <select id="injShellPlatform">
          ${platforms.map((item) =>
            `<option value="${item}"${item === state.shellPlatform ? " selected" : ""}>${item}</option>`).join("")}
        </select>
      </label>
    </div>

    <h4 class="shell-section">Callbacks<span>${visible.length}</span></h4>
    <div class="shell-list">
      ${visible.map((item) => row(item.id, `${item.label} · ${item.platform}`, item.note, renderTemplate(item.template, options))).join("")}
    </div>

    <h4 class="shell-section">Listeners<span>${LISTENERS.length}</span></h4>
    <div class="shell-list">
      ${LISTENERS.map((item) => row(item.id, item.label, item.note, renderTemplate(item.template, options))).join("")}
    </div>

    <h4 class="shell-section">Terminal upgrades<span>${TTY_UPGRADES.length}</span></h4>
    <div class="shell-list">
      ${TTY_UPGRADES.map((item) => row(item.id, item.label, item.note, renderTemplate(item.template, options))).join("")}
    </div>
  </section>`;
}

function renderBrowser(state: InjectorState): string {
  const status = libraryStatus();

  if (status === "loading" || status === "idle") {
    return card("PAYLOAD LIBRARY", "", `<p class="rail-empty">Loading payload library…</p>`);
  }
  if (status === "error") {
    return card("PAYLOAD LIBRARY", "unavailable",
      `<p class="rail-empty">The payload library could not be loaded: ${escapeHtml(libraryError())}</p>
       <p class="rail-empty">The source box below still works, so custom payloads can be injected.</p>`);
  }

  const library = loadedLibrary();
  if (!library || library.categories.length === 0) {
    return card("PAYLOAD LIBRARY", "empty", `<p class="rail-empty">The payload library is empty.</p>`);
  }

  const totals = libraryTotals();
  const category = library.categories[Math.min(state.categoryIndex, library.categories.length - 1)]!;
  const group = category.groups[Math.min(state.groupIndex, category.groups.length - 1)]!;
  const { shown, total } = filterPayloads(group, state.query, PAYLOAD_RENDER_LIMIT);

  const heading = `${totals.categories} categories · ${totals.groups} sets · ${totals.payloads.toLocaleString()} payloads`;

  return card("PAYLOAD LIBRARY", heading, `
    <div class="payload-browser">
      <div class="payload-column">
        <h4>Category</h4>
        <div class="payload-scroll">
          ${library.categories.map((item, index) => `
            <button type="button" class="payload-cat${index === state.categoryIndex ? " active" : ""}"
              data-payload-category="${index}">
              <b>${escapeHtml(item.name)}</b><span>${categoryTotal(item).toLocaleString()}</span>
            </button>`).join("")}
        </div>
      </div>

      <div class="payload-column">
        <h4>Set</h4>
        <div class="payload-scroll">
          ${category.groups.map((item, index) => `
            <button type="button" class="payload-cat${index === state.groupIndex ? " active" : ""}"
              data-payload-group="${index}">
              <b>${escapeHtml(item.name)}</b><span>${item.items.length.toLocaleString()}</span>
            </button>`).join("")}
        </div>
      </div>

      <div class="payload-column payload-column-wide">
        <h4>Payload
          <input id="injQuery" class="payload-filter" value="${escapeHtml(state.query)}"
            placeholder="Filter ${group.items.length.toLocaleString()} payloads…" spellcheck="false">
        </h4>
        <div class="payload-scroll payload-list">
          ${shown.length === 0
            ? `<p class="rail-empty">No payload matches that filter.</p>`
            : shown.map((item) => {
                const key = payloadKey(item.v);
                return `<button type="button" class="payload-item${key === state.payloadKey ? " active" : ""}"
                  data-payload-value="${escapeHtml(item.v)}">
                  <code>${escapeHtml(item.v.length > 220 ? `${item.v.slice(0, 220)}…` : item.v)}</code>
                  <small>${escapeHtml(item.n)}</small>
                </button>`;
              }).join("")}
          ${total > shown.length
            ? `<p class="payload-more">${(total - shown.length).toLocaleString()} more match — narrow the filter to see them.</p>`
            : ""}
        </div>
      </div>
    </div>`);
}

/** Stable identity for a payload, used only to mark the selected row. */
export function payloadKey(value: string): string {
  return value.length > 120 ? `${value.slice(0, 120)}#${value.length}` : value;
}

function card(title: string, meta: string, body: string): string {
  return `<section class="content-card">
    <div class="card-heading"><h3>${escapeHtml(title)}</h3>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</div>
    ${body}
  </section>`;
}

function formatOffset(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
