import { byteToBits } from "../bit-editor";
import { forgeButton } from "./forge-button";

/**
 * Inline byte editor rendered inside the hex grid, directly beneath the active row.
 *
 * Conventional hex editors (hexed.it among them) push bit-level editing into a separate
 * side panel, so the byte you are changing and the controls that change it are at
 * opposite ends of the screen. Here the editor opens in the grid itself, on the row that
 * owns the byte, so the edit happens where the eye already is.
 *
 * Three ways to change the same byte, all live:
 *   - two nibble dials (high/low), stepped with the buttons or typed over
 *   - eight bit switches, MSB on the left, each showing its positional weight
 *   - the decoded readouts, which double as the verification of what you just did
 */

export interface ByteForgeState {
  offset: number;
  value: number;
  /** Byte as it exists on disk, before any patch. Drives the revert control. */
  original: number;
  /** True when the high nibble is typed but the low nibble is still pending. */
  pendingNibble: boolean;
}

const CHAR_NAMES: Record<number, string> = {
  0: "NUL", 7: "BEL", 8: "BS", 9: "TAB", 10: "LF", 11: "VT", 12: "FF", 13: "CR",
  27: "ESC", 32: "SPACE", 127: "DEL"
};

function describeCharacter(value: number): string {
  const named = CHAR_NAMES[value];
  if (named) return named;
  if (value < 32 || value === 127) return `CTL-${value}`;
  if (value > 126 && value < 160) return `C1-${value}`;
  return String.fromCharCode(value);
}

/** Signed interpretation, which matters when patching flags and offsets by hand. */
function signed(value: number): number {
  return value > 127 ? value - 256 : value;
}

export function renderByteForge(state: ByteForgeState): string {
  const { offset, value, original, pendingNibble } = state;
  const hex = value.toString(16).padStart(2, "0").toUpperCase();
  const bits = byteToBits(value);
  const dirty = value !== original;

  // MSB first: bit 7 on the left, matching how the binary string reads.
  const bitSwitches = Array.from({ length: 8 }, (_, index) => {
    const bitIndex = 7 - index;
    const on = bits[index] === "1";
    return `<button type="button" class="bf-bit${on ? " on" : ""}" data-bit="${bitIndex}"
      title="Bit ${bitIndex} · weight ${1 << bitIndex} · click to flip"
      aria-pressed="${on}"><b>${on ? "1" : "0"}</b><small>${bitIndex}</small></button>`;
  }).join("");

  const nibble = (which: "hi" | "lo", digit: string) => `
    <div class="bf-nibble${which === "hi" && pendingNibble ? " pending" : ""}">
      <button type="button" class="bf-step" data-nibble-step="${which}:1" title="Increase" aria-label="Increase ${which} nibble">+</button>
      <input class="bf-nibble-input" data-nibble="${which}" value="${digit}" maxlength="1"
        inputmode="text" spellcheck="false" aria-label="${which === "hi" ? "High" : "Low"} nibble">
      <button type="button" class="bf-step" data-nibble-step="${which}:-1" title="Decrease" aria-label="Decrease ${which} nibble">−</button>
      <span class="bf-nibble-tag">${which === "hi" ? "HIGH" : "LOW"}</span>
    </div>`;

  return `<div class="byte-forge" data-forge-offset="${offset}">
    <div class="bf-identity">
      <span class="bf-label">EDITING</span>
      <code class="bf-offset">0x${offset.toString(16).toUpperCase().padStart(8, "0")}</code>
      ${dirty ? `<span class="bf-dirty" title="Differs from the byte on disk">MODIFIED</span>` : ""}
    </div>

    <div class="bf-nibbles">
      ${nibble("hi", hex[0] ?? "0")}
      ${nibble("lo", hex[1] ?? "0")}
    </div>

    <div class="bf-bits" role="group" aria-label="Bit switches, most significant first">
      ${bitSwitches}
    </div>

    <dl class="bf-readout">
      <div><dt>DEC</dt><dd>${value}</dd></div>
      <div><dt>SIGNED</dt><dd>${signed(value)}</dd></div>
      <div><dt>OCT</dt><dd>${value.toString(8).padStart(3, "0")}</dd></div>
      <div><dt>CHAR</dt><dd>${escapeHtml(describeCharacter(value))}</dd></div>
      <div><dt>WAS</dt><dd>${original.toString(16).padStart(2, "0").toUpperCase()}</dd></div>
    </dl>

    <div class="bf-actions">
      ${forgeButton({ text: "Revert", action: "forge-revert", variant: "is-ghost is-compact", disabled: !dirty, title: "Restore the byte on disk" })}
      ${forgeButton({ text: "Invert", action: "forge-invert", variant: "is-ghost is-compact", title: "Flip every bit" })}
      ${forgeButton({ text: "Next", action: "forge-next", variant: "is-primary is-compact", title: "Commit and move to the next byte" })}
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
