/**
 * Landing background field, cursor spotlight, stat counters, and mobile menu.
 *
 * The background is drawn locally rather than streamed from a CDN, for two reasons:
 * this application's whole premise is that it works with the network unplugged, and a
 * hotlinked asset can vanish without warning. A canvas field also stays sharp at any
 * resolution and costs a few kilobytes instead of megabytes.
 *
 * To use a video instead, drop a file at `public/bg.mp4` and swap `.bg-field` for a
 * `<video>` in landing.ts -- the layering and veil already accommodate it.
 */

interface Column {
  x: number;
  y: number;
  speed: number;
  glyphs: string[];
  length: number;
}

const GLYPHS = "0123456789ABCDEF";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Falling hexadecimal rain with a soft nebula wash, drawn to one canvas.
 *
 * `intensity` scales glyph brightness. The workstation runs the same field at a low
 * value so the texture survives behind the interface without competing with the data
 * an analyst is actually reading.
 */
export function startBackground(surface: HTMLElement, intensity = 1): () => void {
  const canvas = surface.querySelector<HTMLCanvasElement>(".bg-field");
  const spotlight = surface.querySelector<HTMLElement>(".cursor-spotlight");
  if (!canvas) return () => {};

  const context2d = canvas.getContext("2d", { alpha: false });
  if (!context2d) return () => {};

  // Bind non-null locals: narrowing from the guards above is not carried into the
  // closures below, and the alternative is a null check in every draw call.
  const view: HTMLCanvasElement = canvas;
  const context: CanvasRenderingContext2D = context2d;

  let width = 0;
  let height = 0;
  let columns: Column[] = [];
  let frame = 0;
  let running = false;
  let cellSize = 18;

  // Cap the backing store at 2x: beyond that fill cost rises quadratically for a
  // deliberately low-contrast background.
  const ratio = (): number => Math.min(window.devicePixelRatio || 1, 2);

  function resize(): void {
    const rect = surface.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const scale = ratio();
    view.width = Math.floor(width * scale);
    view.height = Math.floor(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);

    cellSize = width > 2200 ? 24 : width > 1400 ? 20 : 16;
    const count = Math.ceil(width / cellSize);
    columns = Array.from({ length: count }, (_, index) => makeColumn(index, true));
  }

  function makeColumn(index: number, seed = false): Column {
    const length = 6 + Math.floor(Math.random() * 16);
    return {
      x: index * cellSize,
      y: seed ? Math.random() * height : -length * cellSize,
      speed: 0.35 + Math.random() * 1.15,
      length,
      glyphs: Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * 16)] ?? "0")
    };
  }

  function paintNebula(): void {
    const wash = context.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, "#03070f");
    wash.addColorStop(0.5, "#000000");
    wash.addColorStop(1, "#040a14");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);

    // Two slow drifting orbs give the field depth without a second animation loop.
    const t = performance.now() / 9000;
    const orb = (cx: number, cy: number, radius: number, colour: string): void => {
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, colour);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    };
    orb(width * (0.3 + Math.sin(t) * 0.08), height * (0.28 + Math.cos(t * 0.8) * 0.07), Math.max(width, height) * 0.42, "rgba(28, 108, 200, 0.20)");
    orb(width * (0.74 + Math.cos(t * 0.7) * 0.07), height * (0.66 + Math.sin(t * 0.9) * 0.06), Math.max(width, height) * 0.34, "rgba(12, 60, 140, 0.18)");
  }

  function draw(): void {
    if (!running) return;
    paintNebula();

    context.textBaseline = "top";
    context.font = `600 ${Math.round(cellSize * 0.72)}px ui-monospace, Consolas, monospace`;

    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      if (!column) continue;
      column.y += column.speed;
      if (column.y - column.length * cellSize > height) {
        columns[index] = makeColumn(index);
        continue;
      }
      for (let i = 0; i < column.length; i += 1) {
        const glyphY = column.y - i * cellSize;
        if (glyphY < -cellSize || glyphY > height) continue;
        // Head glyph is brightest; the tail fades out behind it.
        const fade = 1 - i / column.length;
        if (i === 0) context.fillStyle = `rgba(190, 235, 255, ${((0.85 * fade + 0.15) * intensity).toFixed(3)})`;
        else context.fillStyle = `rgba(70, 160, 240, ${(fade * 0.5 * intensity).toFixed(3)})`;
        context.fillText(column.glyphs[i] ?? "0", column.x, glyphY);
      }
      // Occasionally mutate a glyph so the columns are never static strings.
      if (Math.random() < 0.03) {
        const at = Math.floor(Math.random() * column.length);
        column.glyphs[at] = GLYPHS[Math.floor(Math.random() * 16)] ?? "0";
      }
    }

    frame = window.requestAnimationFrame(draw);
  }

  function start(): void {
    if (running || REDUCED.matches) return;
    running = true;
    frame = window.requestAnimationFrame(draw);
  }
  function stop(): void {
    running = false;
    window.cancelAnimationFrame(frame);
  }
  function onVisibility(): void { if (document.hidden) stop(); else start(); }

  function onPointerMove(event: PointerEvent): void {
    if (!spotlight) return;
    spotlight.style.setProperty("--mx", `${event.clientX}px`);
    spotlight.style.setProperty("--my", `${event.clientY}px`);
    spotlight.style.setProperty("--on", "1");
  }
  function onPointerLeave(): void { spotlight?.style.setProperty("--on", "0"); }

  const observer = new ResizeObserver(resize);
  observer.observe(surface);
  resize();

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  if (REDUCED.matches) {
    // One static frame keeps the texture without motion.
    paintNebula();
    context.font = `600 ${Math.round(cellSize * 0.72)}px ui-monospace, Consolas, monospace`;
    context.textBaseline = "top";
    for (const column of columns) {
      for (let i = 0; i < column.length; i += 1) {
        context.fillStyle = `rgba(70, 160, 240, ${((1 - i / column.length) * 0.35 * intensity).toFixed(3)})`;
        context.fillText(column.glyphs[i] ?? "0", column.x, column.y - i * cellSize);
      }
    }
  } else {
    start();
  }

  return () => {
    stop();
    observer.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Counts each stat up once, when the footer first enters view. */
export function startCounters(scope: HTMLElement): () => void {
  const values = [...scope.querySelectorAll<HTMLElement>(".stat-value")];
  if (values.length === 0) return () => {};

  const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
  let done = false;

  const run = (): void => {
    if (done) return;
    done = true;
    values.forEach((element, index) => {
      const target = Number(element.dataset.target ?? 0);
      const suffix = element.dataset.suffix ?? "";
      const decimals = Number(element.dataset.decimals ?? 0);
      const duration = 1500 + index * 80;
      const startAt = performance.now() + 480 + index * 90;

      const tick = (now: number): void => {
        if (now < startAt) { window.requestAnimationFrame(tick); return; }
        const progress = Math.min(1, (now - startAt) / duration);
        const value = target * easeOutCubic(progress);
        element.textContent = `${value.toFixed(decimals)}${suffix}`;
        if (progress < 1) window.requestAnimationFrame(tick);
        else element.textContent = `${target.toFixed(decimals)}${suffix}`;
      };
      window.requestAnimationFrame(tick);
    });
  };

  if (REDUCED.matches) {
    for (const element of values) {
      const target = Number(element.dataset.target ?? 0);
      element.textContent = `${target.toFixed(Number(element.dataset.decimals ?? 0))}${element.dataset.suffix ?? ""}`;
    }
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { run(); observer.disconnect(); }
  }, { threshold: 0.25 });
  observer.observe(scope);
  return () => observer.disconnect();
}

/** Mobile menu: burger toggle, overlay, Escape, link dismissal, breakpoint reset. */
export function bindMobileMenu(scope: HTMLElement): () => void {
  const burger = scope.querySelector<HTMLButtonElement>("#burger");
  const overlay = scope.querySelector<HTMLElement>("#menuOverlay");
  const sheet = scope.querySelector<HTMLElement>("#mobileMenu");
  if (!burger || !overlay || !sheet) return () => {};

  const setOpen = (open: boolean): void => {
    burger.setAttribute("aria-expanded", String(open));
    overlay.hidden = !open;
    sheet.hidden = !open;
    document.body.classList.toggle("menu-open", open);
  };

  const onBurger = (): void => setOpen(burger.getAttribute("aria-expanded") !== "true");
  const onOverlay = (): void => setOpen(false);
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") setOpen(false); };
  const onLink = (event: Event): void => {
    if ((event.target as HTMLElement).closest(".menu-link, .menu-signin")) setOpen(false);
  };
  const onResize = (): void => { if (window.innerWidth > 720) setOpen(false); };

  burger.addEventListener("click", onBurger);
  overlay.addEventListener("click", onOverlay);
  document.addEventListener("keydown", onKey);
  sheet.addEventListener("click", onLink);
  window.addEventListener("resize", onResize);

  return () => {
    burger.removeEventListener("click", onBurger);
    overlay.removeEventListener("click", onOverlay);
    document.removeEventListener("keydown", onKey);
    sheet.removeEventListener("click", onLink);
    window.removeEventListener("resize", onResize);
    document.body.classList.remove("menu-open");
  };
}


/**
 * Overlay panels for the secondary navigation.
 *
 * The landing does not scroll, so Capabilities and Privacy cannot be anchor targets.
 * They open a dialog instead. Anchors would also churn the hash router and re-render
 * the landing, restarting every entrance animation.
 */
export function bindPanels(scope: HTMLElement): () => void {
  const scrim = scope.querySelector<HTMLElement>("#panelScrim");
  if (!scrim) return () => {};

  let openPanel: HTMLElement | null = null;
  let lastFocused: HTMLElement | null = null;

  const close = (): void => {
    if (!openPanel) return;
    openPanel.hidden = true;
    scrim.hidden = true;
    openPanel = null;
    document.body.classList.remove("panel-open");
    lastFocused?.focus();
  };

  const open = (name: string, trigger: HTMLElement): void => {
    const panel = scope.querySelector<HTMLElement>(`#panel-${CSS.escape(name)}`);
    if (!panel) return;
    close();
    lastFocused = trigger;
    panel.hidden = false;
    scrim.hidden = false;
    openPanel = panel;
    document.body.classList.add("panel-open");
    panel.querySelector<HTMLElement>(".panel-close")?.focus();
  };

  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;

    const opener = target.closest<HTMLElement>("[data-panel]");
    if (opener) {
      event.preventDefault();
      open(opener.dataset.panel ?? "", opener);
      return;
    }
    if (target.closest("[data-panel-close]")) { event.preventDefault(); close(); return; }
    // A panel CTA routes into the app; dismiss first so the landing is clean on return.
    if (target.closest(".panel-cta")) close();
  };

  const onScrim = (): void => close();
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") close(); };

  scope.addEventListener("click", onClick);
  scrim.addEventListener("click", onScrim);
  document.addEventListener("keydown", onKey);

  return () => {
    scope.removeEventListener("click", onClick);
    scrim.removeEventListener("click", onScrim);
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("panel-open");
  };
}


/**
 * Pointer-tracked light with no background field.
 *
 * The workstation runs this alone: the falling-glyph field was too busy behind a dense
 * interface, but the cursor light is a useful focus cue. Position is written to custom
 * properties so the browser only recomposites the layer -- it never restyles the tree
 * on pointer motion.
 */
export function startSpotlight(element: HTMLElement): () => void {
  const onMove = (event: PointerEvent): void => {
    element.style.setProperty("--mx", `${event.clientX}px`);
    element.style.setProperty("--my", `${event.clientY}px`);
    element.style.setProperty("--on", "1");
  };
  const onLeave = (): void => element.style.setProperty("--on", "0");

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerleave", onLeave);
  };
}
