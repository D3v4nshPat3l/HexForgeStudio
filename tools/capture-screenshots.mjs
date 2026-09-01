/**
 * Captures the documentation screenshots.
 *
 * Serves the production build, drives every view with a representative file, and
 * writes PNGs into docs/screenshots. Run after `npm run build`:
 *
 *     node tools/capture-screenshots.mjs
 *
 * Sample files are generated in memory, so nothing on disk is read or modified.
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "docs", "screenshots");
const PORT = 4188;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".map": "application/json"
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const path = (request.url ?? "/").split("?")[0];
      let file = join(DIST, path === "/" ? "index.html" : decodeURIComponent(path));
      if (!existsSync(file)) file = join(DIST, "index.html");
      try {
        const body = await readFile(file);
        response.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
        response.end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

/** Builds a small file of the given kind entirely in the page. */
const SAMPLES = {
  pdf: `(() => { const e=new TextEncoder(); const head=e.encode("%PDF-1.7\\n%\\xE2\\xE3\\xCF\\xD3\\n");
    const body=[]; for (let i=0;i<40;i++){ body.push(...e.encode(\`\${i} 0 obj\\n<< /Type /Page /Contents \${i+1} 0 R >>\\nstream\\n\`));
      let s=i*7919+13; for(let j=0;j<900;j++){ s=(s*1103515245+12345)&0x7fffffff; body.push(65+((s>>16)%58)); }
      body.push(...e.encode("\\nendstream\\nendobj\\n")); }
    body.push(...e.encode("trailer\\n<< /Root 1 0 R >>\\n%%EOF"));
    return new File([new Uint8Array([...head,...body])], "evidence-sample.pdf", { type: "application/pdf" }); })()`,

  exe: `(() => { const b=new Uint8Array(8192); b.set([0x4D,0x5A,0x90,0x00,0x03,0x00,0x00,0x00,0x04],0);
    new DataView(b.buffer).setUint32(0x3c, 0x80, true);
    b.set([0x50,0x45,0x00,0x00, 0x4c,0x01, 0x03,0x00],0x80);
    const e=new TextEncoder();
    b.set(e.encode("This program cannot be run in DOS mode."), 0x4e);
    b.set(e.encode(".text"), 0x180); b.set(e.encode(".rdata"), 0x1a8); b.set(e.encode(".rsrc"), 0x1d0);
    b.set(e.encode("kernel32.dll VirtualAlloc CreateRemoteThread WriteProcessMemory IsDebuggerPresent"), 0x600);
    b.set(e.encode("http://198.51.100.20/beacon SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run"), 0x700);
    for (let i=0x1000;i<b.length;i++) b[i]=(i*137)&0xff;
    return new File([b], "suspicious-sample.exe", { type: "application/x-msdownload" }); })()`,

  png: `(() => { const c=document.createElement("canvas"); c.width=240; c.height=160;
    const x=c.getContext("2d"); const g=x.createLinearGradient(0,0,240,160);
    g.addColorStop(0,"#0a0a0b"); g.addColorStop(1,"#3fb950"); x.fillStyle=g; x.fillRect(0,0,240,160);
    x.fillStyle="#fff"; x.font="bold 22px monospace"; x.fillText("HEXFORGE",28,90);
    return new Promise(r=>c.toBlob(b=>r(new File([b],"sample-image.png",{type:"image/png"})),"image/png")); })()`
};

async function openFile(page, kind) {
  await page.evaluate(async (expression) => {
    const file = await eval(expression);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector("#fileInput");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, SAMPLES[kind]);
  await page.waitForTimeout(7000);
}

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  captured ${name}.png`);
}

async function view(page, name) {
  await page.click(`.view-tab[data-view="${name}"]`);
  await page.waitForTimeout(1400);
}

const server = await serve();
await mkdir(OUT, { recursive: true });

// Use whichever Chromium build is already on disk. The npm package and the downloaded
// browser can drift apart, and re-downloading a browser to take screenshots is wasteful.
const installed = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(installed ? { executablePath: installed } : {});
// The console is dark only; headless Chromium reports a light preference, and saying
// so here keeps form controls and scrollbars from rendering light.
const page = await browser.newPage({
  viewport: { width: 1680, height: 945 },
  deviceScaleFactor: 1,
  colorScheme: "dark"
});

console.log("capturing:");
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2600);            // let the entrance animations settle
await shot(page, "01-landing");

// Capabilities panel on the landing
await page.click('[data-panel="capabilities"]');
await shot(page, "02-landing-capabilities");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

await page.evaluate(() => { window.location.hash = "#/app"; });
await page.waitForTimeout(2600);
await shot(page, "03-workstation-empty");

// A document: signature, threat, forensics, hex
await openFile(page, "pdf");
await view(page, "hex");
await shot(page, "04-hex-editor");

await page.evaluate(() => {
  const cell = document.querySelectorAll('.hex-byte:not(.empty)')[37];
  cell?.click();
});
await shot(page, "05-byte-editor");

await view(page, "signature");
await shot(page, "06-signature-analysis");
await view(page, "intel");
await shot(page, "07-threat-intelligence");
await view(page, "forensics");
await shot(page, "08-forensics-lab");
await view(page, "comparison");
await shot(page, "09-file-comparison");

// Injector: library, then the connect-back builder
await view(page, "injector");
await page.waitForTimeout(4000);
await shot(page, "10-injector-library");
await page.click('[data-injector-tool="shell"]');
await page.waitForTimeout(3500);
await shot(page, "11-connect-back-builder");

await view(page, "report");
await shot(page, "12-pdf-report");

// An executable, so the PE analyzer has something to show
await openFile(page, "exe");
await page.waitForTimeout(2000);
if (await page.locator('.view-tab[data-view="preview"]:not(.tab-hidden)').count()) {
  await view(page, "preview");
  await shot(page, "13-pe-analysis");
}
await view(page, "intel");
await shot(page, "14-threat-executable");

// Wide view, and the light theme
await view(page, "hex");
await page.click('[data-action="toggle-wide"]');
await shot(page, "15-wide-view");
await page.click('[data-action="toggle-wide"]');
await page.waitForTimeout(600);


await browser.close();
server.close();
console.log(`\nwrote screenshots to docs/screenshots`);
