/**
 * Full-screen kinetic navigation.
 *
 * A port of the Sterling Gate navigation pattern to this project's stack -- vanilla
 * TypeScript and GSAP, with no React, Tailwind or shadcn involved. The motion is the
 * same: three backdrop panels sweep in on a stagger, the links rise and unrotate
 * behind their own masks, and hovering an item blooms a matching ambient shape.
 *
 * The panels sweep in three dimensions rather than sliding flat -- each arrives on its
 * own rotateY, so the stack reads as depth instead of as sliding rectangles.
 *
 * Ambient shapes are drawn in the product palette rather than the indigo and violet of
 * the original, so the overlay belongs to the same application as the workstation
 * behind it.
 */

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

interface KineticItem {
  label: string;
  detail: string;
  href?: string;
  panel?: string;
}

const ITEMS: KineticItem[] = [
  { label: "Home", detail: "Overview", href: "#/" },
  { label: "Workstation", detail: "Open the editor", href: "#/app" },
  { label: "Capabilities", detail: "What it analyses", panel: "capabilities" },
  { label: "Privacy", detail: "Where your bytes go", panel: "privacy" },
  { label: "Launch", detail: "Start a session", href: "#/app" }
];

/** Ambient shapes, one per item, drawn from the accent, amber and violet tokens. */
const SHAPES = [
  '<circle class="shape-element" cx="80" cy="120" r="40" fill="rgba(63,185,80,0.20)"/>' +
    '<circle class="shape-element" cx="300" cy="80" r="60" fill="rgba(63,185,80,0.13)"/>' +
    '<circle class="shape-element" cx="200" cy="300" r="80" fill="rgba(163,113,247,0.11)"/>' +
    '<circle class="shape-element" cx="350" cy="280" r="30" fill="rgba(210,153,34,0.16)"/>',

  '<path class="shape-element" d="M0 200 Q100 100, 200 200 T 400 200" stroke="rgba(63,185,80,0.22)" stroke-width="60" fill="none"/>' +
    '<path class="shape-element" d="M0 280 Q100 180, 200 280 T 400 280" stroke="rgba(86,211,100,0.15)" stroke-width="40" fill="none"/>',

  '<circle class="shape-element" cx="50" cy="50" r="8" fill="rgba(63,185,80,0.34)"/>' +
    '<circle class="shape-element" cx="150" cy="50" r="8" fill="rgba(86,211,100,0.30)"/>' +
    '<circle class="shape-element" cx="250" cy="50" r="8" fill="rgba(210,153,34,0.28)"/>' +
    '<circle class="shape-element" cx="350" cy="50" r="8" fill="rgba(63,185,80,0.30)"/>' +
    '<circle class="shape-element" cx="100" cy="150" r="12" fill="rgba(86,211,100,0.26)"/>' +
    '<circle class="shape-element" cx="200" cy="150" r="12" fill="rgba(163,113,247,0.24)"/>' +
    '<circle class="shape-element" cx="300" cy="150" r="12" fill="rgba(63,185,80,0.26)"/>' +
    '<circle class="shape-element" cx="50" cy="250" r="10" fill="rgba(210,153,34,0.26)"/>' +
    '<circle class="shape-element" cx="150" cy="250" r="10" fill="rgba(63,185,80,0.30)"/>' +
    '<circle class="shape-element" cx="250" cy="250" r="10" fill="rgba(86,211,100,0.28)"/>' +
    '<circle class="shape-element" cx="350" cy="250" r="10" fill="rgba(163,113,247,0.26)"/>' +
    '<circle class="shape-element" cx="200" cy="350" r="6" fill="rgba(63,185,80,0.30)"/>',

  '<path class="shape-element" d="M100 100 Q150 50, 200 100 Q250 150, 200 200 Q150 250, 100 200 Q50 150, 100 100" fill="rgba(63,185,80,0.14)"/>' +
    '<path class="shape-element" d="M250 200 Q300 150, 350 200 Q400 250, 350 300 Q300 350, 250 300 Q200 250, 250 200" fill="rgba(210,153,34,0.12)"/>',

  '<line class="shape-element" x1="0" y1="100" x2="300" y2="400" stroke="rgba(63,185,80,0.17)" stroke-width="30"/>' +
    '<line class="shape-element" x1="100" y1="0" x2="400" y2="300" stroke="rgba(86,211,100,0.13)" stroke-width="25"/>' +
    '<line class="shape-element" x1="200" y1="0" x2="400" y2="200" stroke="rgba(163,113,247,0.11)" stroke-width="20"/>'
];

function markup(): string {
  const links = ITEMS.map((item, index) => {
    const inner =
      '<span class="nav-link-index">' + String(index).padStart(2, "0") + "</span>" +
      '<span class="nav-link-mask"><span class="nav-link-text">' + item.label + "</span></span>" +
      '<span class="nav-link-detail">' + item.detail + "</span>" +
      '<span class="nav-link-hover-bg" aria-hidden="true"></span>';
    const open = item.panel
      ? '<button type="button" class="nav-link" data-panel="' + item.panel + '">'
      : '<a class="nav-link" href="' + item.href + '">';
    const close = item.panel ? "</button>" : "</a>";
    return '<li class="menu-list-item" data-shape="' + (index + 1) + '">' + open + inner + close + "</li>";
  }).join("");

  const shapes = SHAPES.map(
    (body, index) =>
      '<svg class="bg-shape bg-shape-' + (index + 1) + '" viewBox="0 0 400 400" fill="none" aria-hidden="true">' +
      body +
      "</svg>"
  ).join("");

  return (
    '<div class="nav-overlay-wrapper" id="kineticNav" data-nav="closed">' +
    '<div class="overlay" data-nav-close></div>' +
    '<nav class="menu-content" aria-label="Full screen">' +
    '<div class="menu-bg" aria-hidden="true">' +
    '<div class="backdrop-layer first"></div>' +
    '<div class="backdrop-layer second"></div>' +
    '<div class="backdrop-layer third"></div>' +
    '<div class="ambient-background-shapes">' + shapes + "</div>" +
    "</div>" +
    '<div class="menu-content-wrapper">' +
    '<p class="menu-eyebrow" data-menu-fade>HexForge Studio</p>' +
    '<ul class="menu-list">' + links + "</ul>" +
    '<p class="menu-foot" data-menu-fade>Everything runs on this machine. Nothing is uploaded.</p>' +
    "</div>" +
    "</nav>" +
    "</div>"
  );
}

/**
 * Mounts the overlay and wires it to the trigger button.
 * Returns a teardown that removes every listener and kills the running timeline.
 */
export function startKineticNav(root: HTMLElement, trigger: HTMLElement): () => void {
  if (!gsap.parseEase("kinetic")) CustomEase.create("kinetic", "0.65, 0.01, 0.05, 0.99");

  const host = document.createElement("div");
  host.innerHTML = markup();
  const wrapper = host.firstElementChild as HTMLElement;
  root.appendChild(wrapper);

  const overlay = wrapper.querySelector<HTMLElement>(".overlay")!;
  const menu = wrapper.querySelector<HTMLElement>(".menu-content")!;
  const panels = wrapper.querySelectorAll<HTMLElement>(".backdrop-layer");
  const links = wrapper.querySelectorAll<HTMLElement>(".nav-link-text");
  const fades = wrapper.querySelectorAll<HTMLElement>("[data-menu-fade]");
  const shapesRoot = wrapper.querySelector<HTMLElement>(".ambient-background-shapes")!;
  const triggerTexts = trigger.querySelectorAll<HTMLElement>(".menu-btn-text span");
  const triggerIcon = trigger.querySelector<HTMLElement>(".menu-btn-icon");

  const reduced = REDUCED.matches;
  const duration = reduced ? 0.001 : 0.7;
  let open = false;
  let timeline: gsap.core.Timeline | null = null;

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;
    // Visibility is owned by the stylesheet via `data-nav`, never by the timeline.
    // Driving it from GSAP made the overlay depend on the ticker having rendered a
    // frame, so a stalled or backgrounded ticker left it open in state but invisible.
    if (next) wrapper.dataset.nav = "open";
    trigger.setAttribute("aria-expanded", String(next));
    trigger.setAttribute("aria-label", next ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", next);

    // Killing the previous timeline keeps rapid toggling from stranding a half state.
    timeline?.kill();
    timeline = gsap.timeline({ defaults: { ease: "kinetic", duration } });

    if (next) {
      timeline
        .set(menu, { xPercent: 0 })
        .fromTo(triggerTexts, { yPercent: 0 }, { yPercent: -100, stagger: 0.12 })
        .fromTo(triggerIcon, { rotate: 0 }, { rotate: 315 }, "<")
        .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1 }, "<")
        .fromTo(
          panels,
          { xPercent: 101, rotateY: reduced ? 0 : -14 },
          { xPercent: 0, rotateY: 0, stagger: 0.12, duration: duration * 0.82 },
          "<"
        )
        .fromTo(
          links,
          { yPercent: 140, rotate: reduced ? 0 : 8 },
          { yPercent: 0, rotate: 0, stagger: 0.05 },
          "<+=0.35"
        );
      if (fades.length) {
        timeline.fromTo(
          fades,
          { autoAlpha: 0, yPercent: 50 },
          { autoAlpha: 1, yPercent: 0, stagger: 0.04, clearProps: "all" },
          "<+=0.2"
        );
      }
      // Move focus into the overlay so keyboard users land where the eye does.
      timeline.add(() => wrapper.querySelector<HTMLElement>(".nav-link")?.focus());
    } else {
      timeline
        .to(overlay, { autoAlpha: 0 })
        .to(menu, { xPercent: 120 }, "<")
        .to(triggerTexts, { yPercent: 0 }, "<")
        .to(triggerIcon, { rotate: 0 }, "<")
        // The stylesheet hides the wrapper off `data-nav`, so it is flipped only once
        // the exit has played rather than snapping away at the first frame.
        .add(() => {
          wrapper.dataset.nav = "closed";
          trigger.focus();
        });
    }
  }

  const onTrigger = (): void => setOpen(!open);
  const onOverlay = (): void => setOpen(false);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) setOpen(false);
  };
  // A chosen destination should close the overlay behind it.
  const onPick = (event: Event): void => {
    if ((event.target as HTMLElement).closest(".nav-link")) setOpen(false);
  };

  trigger.addEventListener("click", onTrigger);
  overlay.addEventListener("click", onOverlay);
  wrapper.addEventListener("click", onPick);
  window.addEventListener("keydown", onKey);

  // Hover blooms: one ambient shape per item.
  const cleanups: Array<() => void> = [];
  if (!reduced) {
    wrapper.querySelectorAll<HTMLElement>(".menu-list-item[data-shape]").forEach((item) => {
      const shape = shapesRoot.querySelector<HTMLElement>(".bg-shape-" + item.dataset.shape);
      if (!shape) return;
      const elements = shape.querySelectorAll(".shape-element");

      const enter = (): void => {
        shapesRoot.querySelectorAll(".bg-shape").forEach((other) => other.classList.remove("active"));
        shape.classList.add("active");
        gsap.fromTo(
          elements,
          { scale: 0.5, opacity: 0, rotation: -10 },
          { scale: 1, opacity: 1, rotation: 0, duration: 0.6, stagger: 0.08, ease: "back.out(1.7)", overwrite: "auto" }
        );
      };
      const leave = (): void => {
        gsap.to(elements, {
          scale: 0.8,
          opacity: 0,
          duration: 0.3,
          ease: "power2.in",
          overwrite: "auto",
          onComplete: () => shape.classList.remove("active")
        });
      };

      item.addEventListener("mouseenter", enter);
      item.addEventListener("mouseleave", leave);
      // Keyboard users get the same bloom as pointer users.
      item.addEventListener("focusin", enter);
      item.addEventListener("focusout", leave);
      cleanups.push(() => {
        item.removeEventListener("mouseenter", enter);
        item.removeEventListener("mouseleave", leave);
        item.removeEventListener("focusin", enter);
        item.removeEventListener("focusout", leave);
      });
    });
  }

  return () => {
    timeline?.kill();
    trigger.removeEventListener("click", onTrigger);
    overlay.removeEventListener("click", onOverlay);
    wrapper.removeEventListener("click", onPick);
    window.removeEventListener("keydown", onKey);
    cleanups.forEach((fn) => fn());
    document.body.classList.remove("menu-open");
    wrapper.remove();
  };
}
