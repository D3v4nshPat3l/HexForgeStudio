/**
 * Header button contents.
 *
 * The command bar and view tabs previously used a three-layer hover: the resting label
 * slid out, a second label slid in with an arrow, and a dot flooded the surface. That
 * has been replaced by the same origin fill the landing's primary action and the Menu
 * button use, which is driven from ui/origin-button.ts and needs only a plain label
 * to wrap. What remains here is the markup for that label.
 */

/** Label contents for a header button: an optional leading glyph, then the text. */
export function headerLabel(text: string, trailing = "", icon = ""): string {
  const leading = icon ? `<b class="cmd-icon" aria-hidden="true">${escapeHtml(icon)}</b>` : "";
  return `${leading}<span class="cmd-text">${escapeHtml(text)}</span>${trailing}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
