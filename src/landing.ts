import { BRAND_MARK } from "./brand";

const MODULES = [
  ["01", "Hex editor", "Read and edit hexadecimal bytes or decoded text side by side. Search, navigate, undo, and export a copy."],
  ["02", "Signature analysis", "Identify file formats by their content, check extension mismatches, and find embedded signatures."],
  ["03", "Threat intelligence", "Review indicators and behaviour matches with byte offsets and an explainable risk score."],
  ["04", "Forensics lab", "Calculate hashes, inspect entropy and byte distributions, and extract readable strings."],
  ["05", "File comparison", "Compare two files byte for byte and navigate directly between differences."],
  ["06", "PE analysis & preview", "Inspect portable executable headers and sections, or preview supported image content."],
  ["07", "Injector workbench", "Browse 40,849 test payloads and 135 connect-back command templates; configure encoding and placement and preview the resulting bytes."],
  ["08", "PDF reports", "Create a structured report with case details, analysis findings, charts, and a chain-of-custody continuation block."]
] as const;

function renderModules(): string {
  return MODULES.map(([number, title, description]) => `
    <a class="feature-card reveal" href="#/app">
      <span class="feature-no">${number}</span>
      <span class="feature-copy"><span class="feature-title">${title}</span><span class="feature-description">${description}</span></span>
      <span class="feature-arrow" aria-hidden="true">↗</span>
    </a>`).join("");
}

export function renderLanding(): string {
  return `
  <div class="landing">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="#/" aria-label="HexForge Studio home">
        <span class="brand-mark">${BRAND_MARK}</span><span class="brand-name">HexForge</span><span class="brand-studio">STUDIO</span>
      </a>
      <button class="mobile-menu" type="button" aria-expanded="false" aria-controls="primary-nav">Menu <span aria-hidden="true">＋</span></button>
      <nav class="primary-nav" id="primary-nav" aria-label="Main navigation">
        <a href="#capabilities">Capabilities</a>
        <a href="https://github.com/D3v4nshPat3l/HexForgeStudio" target="_blank" rel="noreferrer">Source code ↗</a>
        <a class="nav-cta" href="#/app">Open workstation <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="main">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="status-dot"></span> LOCAL-FIRST BINARY FORENSICS</p>
          <h1 id="hero-title">Look closer.<br>Find what<br><em>others miss.</em></h1>
          <p class="hero-lede">A considered workspace for the details that matter. Inspect bytes, investigate files, and turn findings into clear evidence — on your machine.</p>
          <div class="hero-actions">
            <a class="button-primary" href="#/app">Open workstation <span aria-hidden="true">↗</span></a>
            <a class="button-text" href="#capabilities">Explore the toolkit ↓</a>
          </div>
          <p class="hero-note">No account. No file uploads. Just your investigation.</p>
        </div>

        <div class="hero-art" aria-label="Illustration of binary file inspection">
          <canvas class="hero-field" id="hero-field" aria-hidden="true"></canvas>
          <div class="art-label art-top"><span>FIELD NOTES / 001</span><span>BINARY INSPECTION</span></div>
          <article class="specimen">
            <div class="spec-head"><span><i class="status-dot"></i> sample.exe</span><span>READ ONLY</span></div>
            <div class="hex-label"><span>OFFSET</span><span>HEX VALUES</span><span>ASCII</span></div>
            <div class="hero-byte-row"><span class="offset">00000000</span><span class="hex-values"><b>4D</b> 5A 90 00 03 00 00 00</span><span class="ascii-value">MZ......</span></div>
            <div class="signature-note"><span class="branch">└</span><b>4D 5A</b><span>DOS executable signature</span></div>
            <div class="spec-foot"><span>PORTABLE EXECUTABLE</span><span>PE32 · x86</span></div>
          </article>
          <p class="annotation"><span></span><span>Every file has a story.<br><b>Start with the first byte.</b></span></p>
          <div class="art-label art-bottom"><span>00000000 — 000000FF</span><span>YOUR FILES STAY YOURS <i class="status-dot"></i></span></div>
        </div>
      </section>

      <div class="trust-strip" aria-label="Product facts">
        <span><b>01 /</b> Eight focused tools</span><span><b>02 /</b> 75+ file signatures</span><span><b>03 /</b> Files stay on device</span><small>BUILT FOR CAREFUL WORK.</small>
      </div>

      <section class="capabilities" id="capabilities" aria-labelledby="capabilities-title">
        <div class="section-intro reveal">
          <p class="eyebrow">THE TOOLKIT / 08 MODULES</p>
          <h2 id="capabilities-title">One file.<br>Every useful angle.</h2>
          <p>Move from byte-level inspection to a shareable report with a complete set of local analysis tools.</p>
          <a class="button-text" href="#/app">Explore the workstation ↗</a>
        </div>
        <div class="feature-grid" aria-label="Workstation modules">${renderModules()}</div>
      </section>

      <section class="privacy-band reveal" id="privacy">
        <div><p class="eyebrow">PRIVATE BY DESIGN</p><h2>Your evidence.<br>Your machine.</h2></div>
        <div><p>Open files locally, investigate with care, and choose what you export. HexForge has no upload endpoint and sends no file data to a server.</p><a class="button-primary" href="#/app">Start an investigation <span aria-hidden="true">↗</span></a></div>
        <span class="byte-ornament" aria-hidden="true">4D 5A 00 01 · 7F 45 4C 46</span>
      </section>
    </main>

    <footer class="site-footer"><span>HexForge Studio <span>/ Independent tools. Careful work.</span></span><small>LOCAL-FIRST / 08 TOOLS</small></footer>
  </div>`;
}
