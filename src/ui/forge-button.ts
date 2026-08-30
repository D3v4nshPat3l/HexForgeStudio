/**
 * Interactive hover button.
 *
 * A native port of the shadcn/React `InteractiveHoverButton`. This project is vanilla
 * TypeScript with hand-authored CSS -- there is no React, Tailwind, or shadcn in the
 * tree -- so the component is reproduced as markup plus CSS rather than pulling a
 * rendering library in for one control. The behaviour is identical: the resting label
 * slides out, a second label slides in with a trailing arrow, and a dot expands to
 * flood the button.
 */

export interface ForgeButtonOptions {
  text: string;
  /** Value reported through `data-action`, used by the delegated click handler. */
  action?: string;
  /** Extra classes, e.g. "is-primary" or "is-danger". */
  variant?: string;
  title?: string;
  disabled?: boolean;
  /** Any additional data-* pairs the caller needs on the element. */
  data?: Record<string, string>;
}

const ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="forge-btn-arrow"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;

export function forgeButton(options: ForgeButtonOptions): string {
  const attrs: string[] = ['type="button"', `class="forge-btn ${options.variant ?? ""}"`.trim()];
  if (options.action) attrs.push(`data-action="${escapeAttribute(options.action)}"`);
  if (options.title) attrs.push(`title="${escapeAttribute(options.title)}"`);
  if (options.disabled) attrs.push("disabled");
  for (const [key, value] of Object.entries(options.data ?? {})) {
    attrs.push(`data-${escapeAttribute(key)}="${escapeAttribute(value)}"`);
  }

  const label = escapeHtml(options.text);
  return `<button ${attrs.join(" ")}>
    <span class="forge-btn-rest">${label}</span>
    <span class="forge-btn-hover"><span>${label}</span>${ARROW}</span>
    <span class="forge-btn-dot" aria-hidden="true"></span>
  </button>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return value.replace(/["&<>]/g, (character) =>
    ({ '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
}
