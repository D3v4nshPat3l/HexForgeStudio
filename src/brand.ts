/**
 * Single source of truth for the product mark.
 *
 * Inlined as a string so it paints before any network request resolves. Gradient and
 * filter ids are `hf`-prefixed to avoid colliding with the chart gradients the report
 * and entropy views inject into the same document.
 */
export const BRAND_MARK = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d="M32 2 59 17.5v29L32 62 5 46.5v-29Z" fill="#242620"/>
  <path d="M32 7 54 19.7v24.6L32 57 10 44.3V19.7Z" fill="none" stroke="#73776b" stroke-width="1.2"/>
  <path d="M22 17h6v30h-6zM36 17h6v30h-6zM28 29h8v6h-8z" fill="#f3f1eb"/>
  <path d="M42 41h8v8h-8z" fill="#b84322"/>
  <path d="M46 45h4M48 43v4" stroke="#f3f1eb" stroke-width="1"/>
</svg>`;
