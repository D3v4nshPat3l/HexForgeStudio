import "./styles.css";
import "./landing.css";
import { renderLanding } from "./landing";
import { applyTheme, resolveInitialTheme, toggleTheme, type ThemeName } from "./theme";

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

function showLanding(): void {
  document.body.classList.remove("app-mode");
  mount.innerHTML = renderLanding();
  document.title = "HexForge Studio Pro — Local-first binary forensics";
  window.scrollTo(0, 0);
  bindLandingChrome();
}

async function showWorkstation(): Promise<void> {
  document.body.classList.add("app-mode");
  document.title = "HexForge Studio Pro — Workstation";

  if (workstationLoaded) {
    // The workstation owns its own DOM; re-entering the route only needs it revealed.
    const { remountWorkstation } = await import("./main");
    remountWorkstation(mount);
    return;
  }

  mount.innerHTML = `<div class="boot-screen"><div class="boot-mark"></div><p>Loading workstation…</p></div>`;
  const { mountWorkstation } = await import("./main");
  workstationLoaded = true;
  mountWorkstation(mount);
}

function bindLandingChrome(): void {
  const nav = mount.querySelector<HTMLElement>(".landing-nav");
  if (!nav) return;
  const onScroll = (): void => { nav.classList.toggle("scrolled", window.scrollY > 12); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  mount.querySelector<HTMLButtonElement>("[data-action='toggle-theme']")?.addEventListener("click", () => {
    theme = toggleTheme(theme);
  });

  // Smooth in-page anchors without letting them clobber the route.
  mount.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not([href^="#/"])').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const target = document.querySelector(anchor.getAttribute("href") ?? "");
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function route(): void {
  const next = isAppRoute() ? "app" : "landing";
  if (next === currentRoute) return;
  currentRoute = next;
  if (next === "app") void showWorkstation();
  else showLanding();
}

window.addEventListener("hashchange", route);
route();
