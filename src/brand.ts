/**
 * Single source of truth for the product mark.
 *
 * Kept as an inline SVG string so it renders on the landing page before any network
 * request resolves, and inherits the active theme through `currentColor` where the
 * gradient does not apply. Ids are prefixed to avoid colliding with chart gradients
 * elsewhere in the document.
 */
export const BRAND_MARK = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="hfPlate" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#1b2f47"/>
      <stop offset="0.55" stop-color="#101d2e"/>
      <stop offset="1" stop-color="#070d16"/>
    </linearGradient>
    <linearGradient id="hfEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7cd8ff"/>
      <stop offset="0.45" stop-color="#2e9fe8"/>
      <stop offset="1" stop-color="#0d4d7d"/>
    </linearGradient>
    <linearGradient id="hfBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#9fdcff"/>
    </linearGradient>
    <filter id="hfSoft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M32 3.5 55.5 17v30L32 60.5 8.5 47V17Z" fill="url(#hfPlate)"/>
  <path d="M32 3.5 55.5 17v30L32 60.5 8.5 47V17Z" fill="none" stroke="url(#hfEdge)" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M32 6.6 52.8 18.5 32 30.4 11.2 18.5Z" fill="#ffffff" opacity="0.06"/>
  <g filter="url(#hfSoft)">
    <rect x="19.4" y="19" width="5.2" height="26" rx="2.6" fill="url(#hfBar)"/>
    <rect x="39.4" y="19" width="5.2" height="26" rx="2.6" fill="url(#hfBar)"/>
    <rect x="19.4" y="29.4" width="25.2" height="5.2" rx="2.6" fill="url(#hfBar)"/>
  </g>
  <circle cx="32" cy="32" r="2.4" fill="#0a1626"/>
  <circle cx="32" cy="32" r="1.1" fill="#7cd8ff"/>
</svg>`;
