import { BRAND_MARK } from "./brand";

/**
 * Marketing surface shown at the root route.
 *
 * Static markup by design: the landing page must paint before the analysis engine
 * is parsed, so nothing here imports the workstation. `main.ts` lazy-loads the app
 * only once the visitor actually launches it.
 */

interface Feature {
  icon: string;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: "◈",
    title: "Threat assessment",
    body: "A composite score across six triage bands, built from capability tagging, indicator extraction, and obfuscation detection. Every finding carries its weight, offsets, and written guidance."
  },
  {
    icon: "⬡",
    title: "Virtualized hex editor",
    body: "Continuous scrolling across multi-gigabyte files. Range-based reads and sparse patches mean the whole file is never held in memory, and edits stay non-destructive until you save."
  },
  {
    icon: "◉",
    title: "Signature intelligence",
    body: "Conservative identification across 100+ formats with stated evidence and confidence, plus embedded-header scanning at every offset — not just the first bytes."
  },
  {
    icon: "▦",
    title: "Entropy analysis",
    body: "Shannon entropy across adaptive sliding windows, byte-frequency distribution, discontinuity mapping, and suspicious-region detection tuned to statistically valid thresholds."
  },
  {
    icon: "⬢",
    title: "Executable inspection",
    body: "PE/COFF parsing with architecture, subsystem, entry point, and a full section table. Writable-and-executable sections and packed code are flagged automatically."
  },
  {
    icon: "▧",
    title: "Forensic dossier",
    body: "A paginated PDF with a risk gauge, generated contents, vector charts, findings register, indicator appendices, and a chain-of-custody block — ready to hand over."
  }
];

const CAPABILITY_CLASSES = [
  "anti-debugging", "sandbox evasion", "code injection", "privilege escalation",
  "persistence", "credential access", "keylogging", "network / C2",
  "cryptography", "ransomware", "discovery", "defence evasion"
];

const STATS = [
  { value: "100+", label: "Formats identified" },
  { value: "14", label: "Behaviour classes" },
  { value: "6", label: "Hash algorithms" },
  { value: "0", label: "Bytes uploaded" }
];

export function renderLanding(): string {
  return `
  <div class="landing">
    <div class="landing-aurora" aria-hidden="true"></div>
    <div class="landing-grid-overlay" aria-hidden="true"></div>

    <header class="landing-nav">
      <a class="landing-brand" href="#/">
        <span class="landing-brand-mark">${BRAND_MARK}</span>
        <span class="landing-brand-text"><b>HexForge</b><i>Studio Pro</i></span>
      </a>
      <nav class="landing-nav-links">
        <a href="#features">Capabilities</a>
        <a href="#engine">Engine</a>
        <a href="#privacy">Privacy</a>
        <a href="https://github.com/D3v4nshPat3l/HexForge-Studio-Pro" target="_blank" rel="noopener noreferrer">GitHub</a>
      </nav>
      <div class="landing-nav-actions">
        <button class="theme-toggle" data-action="toggle-theme" aria-label="Switch theme" title="Switch theme">◐</button>
        <a class="btn-primary" href="#/app">Launch workstation</a>
      </div>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <span class="hero-eyebrow"><i></i> Version 3.0 · Threat intelligence engine</span>
        <h1>The binary forensics workstation that <em>never uploads your evidence</em>.</h1>
        <p class="hero-lede">
          Hex editing, file identification, threat scoring, and handover-ready reporting — in one workspace.
          Every byte is processed on your own machine, because evidence and suspected malware have no business
          on somebody else's server.
        </p>
        <div class="hero-actions">
          <a class="btn-primary btn-lg" href="#/app">Launch workstation <span aria-hidden="true">→</span></a>
          <a class="btn-ghost btn-lg" href="#features">Explore capabilities</a>
        </div>
        <div class="hero-meta">
          <span>✓ No account required</span>
          <span>✓ No installation</span>
          <span>✓ Works offline</span>
        </div>
      </div>

      <aside class="hero-panel" aria-label="Example threat assessment">
        <div class="hero-panel-chrome">
          <i></i><i></i><i></i>
          <span>invoice_2026.pdf</span>
        </div>
        <div class="hero-panel-body">
          <div class="hero-score">
            <div class="hero-dial" style="--deg:342">
              <div><strong>95</strong><small>OF 100</small></div>
            </div>
            <div class="hero-score-copy">
              <b>Critical</b>
              <span>Executable content disguised by its file extension</span>
            </div>
          </div>
          <ul class="hero-findings">
            <li class="sev-critical"><i></i>Code injection indicators<em>5</em></li>
            <li class="sev-critical"><i></i>Destructive / ransomware<em>4</em></li>
            <li class="sev-high"><i></i>Packer artefacts — UPX<em>1</em></li>
            <li class="sev-high"><i></i>Anti-debugging<em>3</em></li>
            <li class="sev-medium"><i></i>High-entropy regions<em>33</em></li>
          </ul>
          <div class="hero-entropy" aria-hidden="true">
            ${Array.from({ length: 44 }, (_, index) => {
              const wave = Math.sin(index / 3.1) * 0.28 + 0.5;
              const spike = index > 26 && index < 39 ? 0.42 : 0;
              const height = Math.min(0.98, wave + spike);
              const tone = height > 0.86 ? "var(--sev-critical)" : height > 0.66 ? "var(--sev-high)" : "var(--accent)";
              return `<i style="height:${(height * 100).toFixed(0)}%;background:${tone}"></i>`;
            }).join("")}
          </div>
        </div>
      </aside>
    </section>

    <section class="stat-band">
      ${STATS.map((stat) => `<div><strong>${stat.value}</strong><span>${stat.label}</span></div>`).join("")}
    </section>

    <section class="section" id="features">
      <div class="section-head">
        <span class="section-eyebrow">Capabilities</span>
        <h2>Everything a binary investigation needs</h2>
        <p>Six subsystems, one workspace, no context switching between a hex editor, a signature database, and a report generator.</p>
      </div>
      <div class="feature-grid">
        ${FEATURES.map((feature) => `
          <article class="feature-card">
            <span class="feature-icon">${feature.icon}</span>
            <h3>${feature.title}</h3>
            <p>${feature.body}</p>
          </article>`).join("")}
      </div>
    </section>

    <section class="section section-split" id="engine">
      <div>
        <span class="section-eyebrow">Threat engine</span>
        <h2>Scoring that shows its working</h2>
        <p class="section-lede">
          Every signal becomes a weighted finding with a severity, the offsets involved, and guidance on how to
          confirm it. Categories are capped independently, so one noisy indicator can never dominate the total.
        </p>
        <div class="chip-cloud">
          ${CAPABILITY_CLASSES.map((item) => `<span class="chip">${item}</span>`).join("")}
        </div>
        <div class="callout callout-warning">
          <strong>The score orders samples for triage. It is not a verdict.</strong>
          A capability match proves a string is present — not that the API is imported, reachable, or ever executed.
          Confirm behaviour in an isolated environment before acting on any finding.
        </div>
      </div>
      <div class="code-panel">
        <div class="code-panel-head"><span>threat assessment</span><span>JSON</span></div>
<pre><code><span class="tok-p">{</span>
  <span class="tok-k">"score"</span><span class="tok-p">:</span> <span class="tok-n">95</span><span class="tok-p">,</span>
  <span class="tok-k">"band"</span><span class="tok-p">:</span> <span class="tok-s">"Critical"</span><span class="tok-p">,</span>
  <span class="tok-k">"categoryScores"</span><span class="tok-p">:</span> <span class="tok-p">{</span>
    <span class="tok-k">"Code execution"</span><span class="tok-p">:</span> <span class="tok-n">26.0</span><span class="tok-p">,</span>
    <span class="tok-k">"Destructive"</span><span class="tok-p">:</span>    <span class="tok-n">26.0</span><span class="tok-p">,</span>
    <span class="tok-k">"Anti-analysis"</span><span class="tok-p">:</span> <span class="tok-n">20.2</span><span class="tok-p">,</span>
    <span class="tok-k">"Obfuscation"</span><span class="tok-p">:</span>   <span class="tok-n">13.5</span>
  <span class="tok-p">}</span><span class="tok-p">,</span>
  <span class="tok-k">"findings"</span><span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-p">{</span>
    <span class="tok-k">"severity"</span><span class="tok-p">:</span> <span class="tok-s">"critical"</span><span class="tok-p">,</span>
    <span class="tok-k">"title"</span><span class="tok-p">:</span> <span class="tok-s">"Executable disguised by extension"</span><span class="tok-p">,</span>
    <span class="tok-k">"offsets"</span><span class="tok-p">:</span> <span class="tok-p">[</span><span class="tok-n">0</span><span class="tok-p">]</span>
  <span class="tok-p">}</span><span class="tok-p">]</span>
<span class="tok-p">}</span></code></pre>
      </div>
    </section>

    <section class="section" id="privacy">
      <div class="privacy-banner">
        <div class="privacy-mark" aria-hidden="true">🔒</div>
        <div>
          <h2>There is no upload endpoint</h2>
          <p>
            This is an architectural guarantee, not a policy promise. Files are read through
            <code>Blob.slice()</code> range requests and analysed in a Web Worker on your own machine.
            No server component exists to receive them, and the application ships no analytics or telemetry.
            Load the page once and it keeps working with your network cable unplugged.
          </p>
          <div class="privacy-points">
            <span>No account</span><span>No tracking</span><span>No transmission</span><span>No installation</span>
          </div>
        </div>
      </div>
    </section>

    <section class="cta">
      <h2>Open a file and start.</h2>
      <p>Nothing to install, nothing to configure, nothing to sign up for.</p>
      <a class="btn-primary btn-lg" href="#/app">Launch workstation <span aria-hidden="true">→</span></a>
    </section>

    <footer class="landing-footer">
      <div class="landing-brand">
        <span class="landing-brand-mark">${BRAND_MARK}</span>
        <span class="landing-brand-text"><b>HexForge</b><i>Studio Pro</i></span>
      </div>
      <p>An analysis aid — not accredited forensic software, and not a malware scanner. Findings require independent corroboration.</p>
      <p class="landing-copyright">© 2026 Devansh Patel. All rights reserved.</p>
    </footer>
  </div>`;
}
