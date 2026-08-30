import { byteToBits } from "../bit-editor";

/**
 * Byte editor panel for the right rail.
 *
 * An earlier version opened this inline inside the hex grid, which covered the rows
 * underneath it -- you could not see or reach the surrounding bytes while editing. It
 * lives in the rail instead: always visible, always in the same place, never occluding
 * the data.
 *
 * Two ways to change the byte, both live: eight bit switches (MSB first, so the row
 * reads in the same order as the binary readout), and the hex field itself.
 */

export interface ByteForgeState {
  offset: number;
  value: number;
  /** Byte as it exists on disk, before any patch. Drives the revert control. */
  original: number;
  hasPatch: boolean;
}

const CONTROL_NAMES: Record<number, string> = {
  0: "NUL", 7: "BEL", 8: "BS", 9: "TAB", 10: "LF", 11: "VT", 12: "FF", 13: "CR",
  27: "ESC", 32: "SP", 127: "DEL"
};

function describeCharacter(value: number): string {
  const named = CONTROL_NAMES[value];
  if (named) return named;
  if (value < 32 || (value >= 127 && value < 160)) return "·";
  return String.fromCharCode(value);
}

export function renderByteForge(state: ByteForgeState | null): string {
  if (!state) return `<p class="rail-empty">Select a byte in the editor.</p>`;

  const { offset, value, original, hasPatch } = state;
  const hex = value.toString(16).padStart(2, "0").toUpperCase();
  const bits = byteToBits(value);

  const switches = Array.from({ length: 8 }, (_, index) => {
    const bitIndex = 7 - index;
    const on = bits[index] === "1";
    return `<button type="button" class="bit${on ? " on" : ""}" data-bit="${bitIndex}"
      aria-pressed="${on}" title="Bit ${bitIndex}, worth ${1 << bitIndex}">${on ? "1" : "0"}</button>`;
  }).join("");

  return `
    <div class="byte-head">
      <input class="byte-hex" id="byteHexInput" value="${hex}" maxlength="2" spellcheck="false"
        inputmode="text" aria-label="Byte value in hexadecimal">
      <div class="byte-meta">
        <code>0x${offset.toString(16).toUpperCase().padStart(8, "0")}</code>
        <span>${value} · ${escapeHtml(describeCharacter(value))}${hasPatch ? ` · was ${original.toString(16).padStart(2, "0").toUpperCase()}` : ""}</span>
      </div>
    </div>

    <div class="bit-row" role="group" aria-label="Bits, most significant first">${switches}</div>
    <div class="bit-scale"><span>128</span><span>64</span><span>32</span><span>16</span><span>8</span><span>4</span><span>2</span><span>1</span></div>

    <div class="byte-actions">
      <button type="button" data-action="forge-invert">Invert</button>
      <button type="button" data-action="forge-revert"${hasPatch ? "" : " disabled"}>Revert</button>
    </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
