/**
 * Interactive hover button.
 *
 * A native port of the shadcn/React `InteractiveHoverButton`. This project is vanilla
 * TypeScript with hand-authored CSS -- there is no React, Tailwind, or shadcn in the
 * tree -- so the component is reproduced as markup plus CSS rather than pulling a
 * rendering library in for one control.
 *
 * Behaviour matches the original: the resting label slides right and fades out, a
 * second label slides in from the right with a trailing arrow, and a dot anchored at
 * 20%/40% expands to flood the surface.
 */

/** lucide-react `ArrowRight`, inlined so the icon package is not a dependency. */
const ARROW_RIGHT = `<svg class="hb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

/**
 * The three layers the effect needs, for callers that own the surrounding button.
 * `trailing` is rendered inside the resting layer only -- a count badge should not be
 * duplicated in the layer that slides in.
 */
export function hoverButtonLayers(text: string, trailing = ""): string {
  const label = escapeHtml(text);
  return `<span class="hb-rest">${label}${trailing}</span>` +
    `<span class="hb-hover" aria-hidden="true"><span>${label}</span>${ARROW_RIGHT}</span>` +
    `<span class="hb-dot" aria-hidden="true"></span>`;
}

export interface HoverButtonOptions {
  text: string;
  action?: string;
  variant?: string;
  title?: string;
  disabled?: boolean;
  data?: Record<string, string>;
}

/** A complete button element carrying the effect. */
export function hoverButton(options: HoverButtonOptions): string {
  const attrs = ['type="button"', `class="hb ${options.variant ?? ""}"`.trim()];
  if (options.action) attrs.push(`data-action="${escapeAttribute(options.action)}"`);
  if (options.title) attrs.push(`title="${escapeAttribute(options.title)}"`);
  if (options.disabled) attrs.push("disabled");
  for (const [key, value] of Object.entries(options.data ?? {})) {
    attrs.push(`data-${escapeAttribute(key)}="${escapeAttribute(value)}"`);
  }
  return `<button ${attrs.join(" ")}>${hoverButtonLayers(options.text)}</button>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return value.replace(/["&<>]/g, (character) =>
    ({ '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character);
}
