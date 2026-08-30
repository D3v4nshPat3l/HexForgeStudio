import "./styles.css";
import "./landing.css";
import { renderLanding } from "./landing";
import { bindMobileMenu, bindPanels, startBackground, startCounters, startSpotlight } from "./ambient";
import { applyTheme, resolveInitialTheme, toggleTheme, type ThemeName } from "./theme";
import { inject } from "@vercel/analytics";

/**
 * Application entry and route switch.
 *
 * Hash routing is deliberate: the app is served from a static host under a project
 * subpath, where History-API routes would 404 on refresh or deep link.
 *
 * The workstation is loaded lazily so a visitor landing on the marketing page never
 * downloads the analysis engine, the worker, or jsPDF.
 */

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing.");
const mount: HTMLDivElement = root;

let theme: ThemeName = resolveInitialTheme();
applyTheme(theme);

let workstationLoaded = false;
let currentRoute = "";

function isAppRoute(): boolean {
  return window.location.hash.replace(/^#/, "").startsWith("/app");
}

/** True for hashes this router owns. Anything else is left alone. */
function isOwnedRoute(): boolean {
  const hash = window.location.hash;
  return hash === "" || hash === "#" || hash.startsWith("#/");
}

let stopAmbient: (() => void) | null = null;

function showLanding(): void {
  document.body.classList.remove("app-mode");
  stopAmbient?.();
  mount.innerHTML = renderLanding();
  document.title = "HexForge Studio Pro — Local-first binary forensics";
  window.scrollTo(0, 0);
  bindLandingChrome();

  const surface = mount.querySelector<HTMLElement>(".landing");
  const stats = mount.querySelector<HTMLElement>("#stats");
  if (surface) {
    const stopField = startBackground(surface);
    const stopMenu = bindMobileMenu(surface);
    const stopPanels = bindPanels(surface);
    const stopCounters = stats ? startCounters(stats) : () => {};
    stopAmbient = () => { stopField(); stopMenu(); stopPanels(); stopCounters(); };
  }
}

async function showWorkstation(): Promise<void> {
  document.body.classList.add("app-mode");
  stopAmbient?.();
  stopAmbient = null;
  document.title = "HexForge Studio Pro — Workstation";

  if (workstationLoaded) {
    // The workstation owns its own DOM; re-entering the route only needs it revealed.
    const { remountWorkstation } = await import("./main");
    remountWorkstation(mount);
    attachWorkstationField();
    return;
  }

  mount.innerHTML = `<div class="boot-screen"><div class="boot-mark"></div><p>Loading workstation…</p></div>`;
  const { mountWorkstation } = await import("./main");
  workstationLoaded = true;
  mountWorkstation(mount);
  attachWorkstationField();
}

function bindLandingChrome(): void {
  mount.querySelector<HTMLButtonElement>("[data-action='toggle-theme']")?.addEventListener("click", () => {
    theme = toggleTheme(theme);
  });

}

function route(): void {
  if (!isOwnedRoute()) return;
  const next = isAppRoute() ? "app" : "landing";
  if (next === currentRoute) return;
  currentRoute = next;
  if (next === "app") void showWorkstation();
  else showLanding();
}

window.addEventListener("hashchange", route);
route();

// Initialize Vercel Web Analytics
inject();


/**
 * Cursor light for the workstation.
 *
 * The animated field is deliberately not carried over: behind a dense interface of
 * tables and byte grids it read as noise rather than texture. The pointer light stays,
 * dimmed well below the landing's, as a focus cue that never competes with the data.
 */
function attachWorkstationField(): void {
  if (mount.querySelector(".app-spotlight")) return;

  const spotlight = document.createElement("div");
  spotlight.className = "cursor-spotlight app-spotlight";
  spotlight.setAttribute("aria-hidden", "true");
  mount.append(spotlight);

  const stop = startSpotlight(spotlight);
  stopAmbient = () => { stop(); spotlight.remove(); };
}
