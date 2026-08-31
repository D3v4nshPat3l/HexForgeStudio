/**
 * Full-screen kinetic navigation.
 *
 * A port of the Sterling Gate navigation pattern to this project's stack -- vanilla
 * TypeScript and GSAP, with no React, Tailwind or shadcn involved. The motion is the
 * same: three backdrop panels sweep in on a stagger and the links rise and unrotate
 * behind their own masks. Hover is deliberately not part of that -- it is a plain
 * colour change, handled in CSS.
 *
 * The panels sweep in three dimensions rather than sliding flat -- each arrives on its
 * own rotateY, so the stack reads as depth instead of as sliding rectangles.
 *
 */

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

export interface KineticItem {
  label: string;
  detail: string;
  href?: string;
  panel?: string;
  /** A workspace view to activate, for the copy mounted inside the workstation. */
  view?: string;
}

export const LANDING_ITEMS: KineticItem[] = [
  { label: "Home", detail: "Overview", href: "#/" },
  { label: "Workstation", detail: "Open the editor", href: "#/app" },
  { label: "Capabilities", detail: "What it analyses", panel: "capabilities" },
  { label: "Privacy", detail: "Where your bytes go", panel: "privacy" },
  { label: "Launch", detail: "Start a session", href: "#/app" }
];

/**
 * Destinations for the copy mounted in the workstation.
 *
 * The view tabs stay where they are; this is a second, larger-target route to the same
 * places that also says what each view is for -- the tab strip has room for a name and
 * nothing else.
 */
export const WORKSTATION_ITEMS: KineticItem[] = [
  { label: "Hex Editor", detail: "Bytes, bits and patches", view: "hex" },
  { label: "Signature Analysis", detail: "Format and magic bytes", view: "signature" },
  { label: "Threat Intelligence", detail: "Behaviour and indicators", view: "intel" },
  { label: "Forensics Lab", detail: "Entropy, strings, hashes", view: "forensics" },
  { label: "File Comparison", detail: "Diff two binaries", view: "comparison" },
  { label: "Injector", detail: "Payloads and connect-back", view: "injector" },
  { label: "PDF Report", detail: "Export the findings", view: "report" },
  { label: "Overview", detail: "Back to the landing", href: "#/" }
];

function markup(items: KineticItem[]): string {
  const links = items.map((item, index) => {
    const inner =
      '<span class="nav-link-index">' + String(index).padStart(2, "0") + "</span>" +
      '<span class="nav-link-mask"><span class="nav-link-text">' + item.label + "</span></span>" +
      '<span class="nav-link-detail">' + item.detail + "</span>";
    let open: string;
    if (item.panel) open = '<button type="button" class="nav-link" data-panel="' + item.panel + '">';
    else if (item.view) open = '<button type="button" class="nav-link" data-view-jump="' + item.view + '">';
    else open = '<a class="nav-link" href="' + item.href + '">';
    const close = item.href && !item.panel && !item.view ? "</a>" : "</button>";
    return '<li class="menu-list-item">' + open + inner + close + "</li>";
  }).join("");

  return (
    '<div class="nav-overlay-wrapper" id="kineticNav" data-nav="closed">' +
    '<div class="overlay" data-nav-close></div>' +
    '<nav class="menu-content" aria-label="Full screen">' +
    '<div class="menu-bg" aria-hidden="true">' +
    '<div class="backdrop-layer first"></div>' +
    '<div class="backdrop-layer second"></div>' +
    '<div class="backdrop-layer third"></div>' +
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
export function startKineticNav(
  root: HTMLElement,
  trigger: HTMLElement,
  items: KineticItem[] = LANDING_ITEMS
): () => void {
  if (!gsap.parseEase("kinetic")) CustomEase.create("kinetic", "0.65, 0.01, 0.05, 0.99");

  const host = document.createElement("div");
  host.innerHTML = markup(items);
  const wrapper = host.firstElementChild as HTMLElement;
  root.appendChild(wrapper);

  const overlay = wrapper.querySelector<HTMLElement>(".overlay")!;
  const menu = wrapper.querySelector<HTMLElement>(".menu-content")!;
  const panels = wrapper.querySelectorAll<HTMLElement>(".backdrop-layer");
  const links = wrapper.querySelectorAll<HTMLElement>(".nav-link-text");
  const fades = wrapper.querySelectorAll<HTMLElement>("[data-menu-fade]");
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
    const link = (event.target as HTMLElement).closest<HTMLElement>(".nav-link");
    if (!link) return;
    // View jumps drive the existing tab strip, so the two routes cannot disagree.
    const view = link.dataset.viewJump;
    if (view) document.querySelector<HTMLElement>('.view-tabs [data-view="' + view + '"]')?.click();
    setOpen(false);
  };

  trigger.addEventListener("click", onTrigger);
  overlay.addEventListener("click", onOverlay);
  wrapper.addEventListener("click", onPick);
  window.addEventListener("keydown", onKey);

  // Hover styling is entirely CSS now: a plain colour change per item, cycled with
  // nth-child. The previous version bloomed a staggered SVG shape behind the list on
  // every hover, which was more spectacle than a menu needs.

  return () => {
    timeline?.kill();
    trigger.removeEventListener("click", onTrigger);
    overlay.removeEventListener("click", onOverlay);
    wrapper.removeEventListener("click", onPick);
    window.removeEventListener("keydown", onKey);
    document.body.classList.remove("menu-open");
    wrapper.remove();
  };
}
