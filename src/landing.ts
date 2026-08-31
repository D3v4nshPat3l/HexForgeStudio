import { BRAND_MARK } from "./brand";

/**
 * Single-viewport landing surface.
 *
 * Three vertical regions inside one 100dvh column -- header, hero, stats -- layered
 * over the animated background. Nothing scrolls: the composition is sized to fit the
 * viewport at every breakpoint.
 *
 * Because there is no scrolling, the secondary navigation cannot use in-page anchors.
 * Capabilities and Privacy open overlay panels instead, driven by `data-panel` rather
 * than by `href="#..."`. Anchor hrefs would also churn the router, which keys off the
 * hash, and re-render the landing on every click.
 *
 * Static markup by design: the landing must paint before the analysis engine is
 * parsed, so nothing here imports the workstation.
 */

interface Stat {
  glyph: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
}

export const STATS: Stat[] = [
  { glyph: "<", target: 100, suffix: "%", decimals: 0, label: "Processed Locally" },
  { glyph: "#", target: 100, suffix: "+", decimals: 0, label: "Formats Identified" },
  { glyph: "*", target: 14, suffix: "", decimals: 0, label: "Behaviour Classes" },
  { glyph: "%", target: 0, suffix: "", decimals: 0, label: "Bytes Uploaded" }
];


const CAPABILITY_GROUPS = [
  {
    icon: "◈",
    title: "Hex editing",
    items: ["Virtualized view over multi-gigabyte files", "Direct nibble-by-nibble byte editing", "Non-destructive sparse patches with full undo", "Bit editor, base converter, source export"]
  },
  {
    icon: "◉",
    title: "Identification",
    items: ["100+ formats by content, not extension", "Extension-mismatch detection", "Embedded signature carving at every offset", "Stated confidence and evidence per match"]
  },
  {
    icon: "⬡",
    title: "Threat intelligence",
    items: ["14 behaviour classes tagged from strings", "Indicators with byte offsets, CSV export", "XOR key recovery and packer fingerprinting", "Capped weighted score across six bands"]
  },
  {
    icon: "▦",
    title: "Forensics",
    items: ["MD5, SHA-1/256/512, BLAKE3, CRC-32", "Adaptive-window entropy and byte histogram", "Strings across four encodings", "Byte-accurate file comparison"]
  },
  {
    icon: "⬢",
    title: "Executables",
    items: ["PE/COFF headers and section table", "Per-section entropy with packing flags", "Writable-and-executable section warnings", "Image preview for decodable formats"]
  },
  {
    icon: "▧",
    title: "Reporting",
    items: ["Paginated PDF dossier with risk gauge", "Vector entropy and section charts", "Findings register with analyst guidance", "Chain-of-custody continuation block"]
  }
];

function panels(): string {
  return `
  <div class="panel-scrim" id="panelScrim" hidden></div>

  <section class="panel" id="panel-capabilities" role="dialog" aria-modal="true" aria-labelledby="capTitle" hidden>
    <header class="panel-head">
      <div>
        <span class="panel-eyebrow">Capabilities</span>
        <h2 id="capTitle">One workspace, six subsystems</h2>
      </div>
      <button type="button" class="panel-close" data-panel-close aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8l8 8M16 8l-8 8"/></svg>
      </button>
    </header>
    <div class="panel-body">
      <div class="cap-grid">
        ${CAPABILITY_GROUPS.map((group) => `
          <article class="cap-card">
            <span class="cap-icon">${group.icon}</span>
            <h3>${group.title}</h3>
            <ul>${group.items.map((item) => `<li>${item}</li>`).join("")}</ul>
          </article>`).join("")}
      </div>
    </div>
    <footer class="panel-foot">
      <span>Every capability runs on your own machine.</span>
      <a class="panel-cta" href="#/app">Launch Workstation</a>
    </footer>
  </section>

  <section class="panel" id="panel-privacy" role="dialog" aria-modal="true" aria-labelledby="privTitle" hidden>
    <header class="panel-head">
      <div>
        <span class="panel-eyebrow">Privacy</span>
        <h2 id="privTitle">There is no upload endpoint</h2>
      </div>
      <button type="button" class="panel-close" data-panel-close aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 8l8 8M16 8l-8 8"/></svg>
      </button>
    </header>
    <div class="panel-body">
      <p class="panel-lede">
        This is an architectural property, not a policy promise. Files are read through
        <code>Blob.slice()</code> range requests and analysed in a Web Worker inside your own
        browser process. No server component exists to receive them.
      </p>
      <div class="privacy-grid">
        <div><b>No transmission</b><span>Nothing is sent anywhere. Load the page once, then disconnect your network — everything still works.</span></div>
        <div><b>No account</b><span>No sign-up, no licence key, no identity. Open a file and start.</span></div>
        <div><b>No telemetry</b><span>The application ships no analytics, no crash reporting, and no usage tracking.</span></div>
        <div><b>No retention</b><span>Nothing is stored server-side because there is no server-side. Closing the tab ends it.</span></div>
      </div>
      <div class="panel-note">
        <b>Why it matters.</b> Evidence under chain of custody, client data, and malware you
        are not licensed to redistribute all fail the moment a tool asks you to upload. Removing
        the upload removes the question.
      </div>
    </div>
    <footer class="panel-foot">
      <span>The local Python server transmits nothing and stores nothing.</span>
      <a class="panel-cta" href="#/app">Launch Workstation</a>
    </footer>
  </section>`;
}

export function renderLanding(): string {
  return `
  <div class="landing">
    <!--
      Depth stage. Layers sit at different Z distances and shift with the pointer, which
      builds parallax without scroll -- this page is a fixed viewport. Only decorative
      layers move; the headline and controls stay put, because parallaxing text hurts
      reading and can cause motion sickness.
    -->
    <div class="stage" aria-hidden="true">
      <div class="stage-layer depth-far"><div class="jp-matrix" id="matrixField"></div></div>
      <div class="stage-layer depth-glow"></div>
      <div class="stage-layer depth-rays"></div>
      <div class="stage-layer depth-grid"></div>
      <div class="stage-layer depth-motes">
        ${Array.from({ length: 18 }, (_, i) => {
          const x = (i * 53) % 100;
          const y = (i * 37) % 100;
          const d = (i % 4) + 1;
          return `<i style="--x:${x}%;--y:${y}%;--z:${d}" data-mote="${d}"></i>`;
        }).join("")}
      </div>
      <div class="bg-veil"></div>
      <div class="stage-vignette"></div>
    </div>
    <div class="cursor-spotlight" aria-hidden="true"></div>

    <div class="page">
      <header class="site-header">
        <a class="logo" href="#/" aria-label="HexForge Studio">${BRAND_MARK}</a>
        <button type="button" class="nav-menu-btn" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="kineticNav">
          <span class="menu-btn-text"><span>Menu</span><span>Close</span></span>
          <span class="menu-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" width="100%">
              <path d="M7.33333 16L7.33333 0L8.66667 0L8.66667 16L7.33333 16Z" fill="currentColor"></path>
              <path d="M16 8.66667L0 8.66667L0 7.33333L16 7.33333L16 8.66667Z" fill="currentColor"></path>
            </svg>
          </span>
        </button>
      </header>

      <main class="hero">
        <div class="trust anim" style="--d:.05s">
          <span class="avatar a1"><span class="avatar-symbol" aria-hidden="true">◆</span></span>
          <span class="avatar a2"><span class="avatar-symbol" aria-hidden="true">◎</span></span>
          <span class="avatar a3"><span class="avatar-symbol" aria-hidden="true">▣</span></span>
          <span class="trust-pill">Evidence never leaves your machine</span>
        </div>

        <h1 class="headline">
          <span class="line"><span class="line-inner" style="--d:.12s">Every Byte</span></span>
          <span class="line"><span class="line-inner" style="--d:.30s">Under Scrutiny</span></span>
        </h1>

        <p class="subhead anim" style="--d:.28s">
          A complete binary forensics workstation — hex editing, threat intelligence and
          court-ready reporting — running entirely on your own machine.
        </p>

        <div class="hero-actions anim" style="--d:.4s">
          <a class="cta anim-pulse" href="#/app">Launch Workstation</a>
          <button type="button" class="cta-ghost" data-panel="capabilities">See what it does</button>
        </div>
      </main>

      <footer class="stats" id="stats">
        ${STATS.map((stat, index) => `
          <div class="stat anim" style="--d:${(0.5 + index * 0.08).toFixed(2)}s">
            <span class="stat-glyph">${stat.glyph}</span>
            <span class="stat-value" data-target="${stat.target}" data-suffix="${stat.suffix}" data-decimals="${stat.decimals}">0${stat.suffix}</span>
            <span class="stat-label">${stat.label}</span>
          </div>`).join("")}
      </footer>
    </div>

    ${panels()}
  </div>`;
}
