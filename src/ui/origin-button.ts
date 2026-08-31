/**
 * Origin button.
 *
 * A port of the Origin Button interaction to this project's stack. A disc grows from
 * the exact point the pointer entered until it covers the control, and retreats to
 * that same point on the way out, so the fill reads as caused by the cursor rather
 * than as a generic hover state.
 *
 * The React original carries its own palette and animates with `motion`. Neither is
 * ported: colour comes from this project's theme tokens so the control matches the
 * surface it sits on, and the growth is a CSS transform transition, which the
 * compositor can run without a library or a per-frame callback.
 *
 * Keyboard parity matters here -- a pointer-origin effect that only pointers can see
 * would leave keyboard users without the state change. Focus fills from the centre,
 * which is the honest origin when there is no cursor.
 */

/** Evaluated on use, not at import: this module is also loaded in a plain Node test run. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Diameter needed to cover the box from (x, y): twice the distance to the far corner. */
export function coverDiameter(width: number, height: number, x: number, y: number): number {
  return Math.ceil(
    2 * Math.max(
      Math.hypot(x, y),
      Math.hypot(width - x, y),
      Math.hypot(x, height - y),
      Math.hypot(width - x, height - y)
    )
  );
}

function prepare(button: HTMLElement): HTMLElement | null {
  if (button.dataset.originReady === "true") {
    return button.querySelector<HTMLElement>(".origin-fill");
  }

  // Existing children become the label, so the fill can sit beneath them.
  const label = document.createElement("span");
  label.className = "origin-label";
  while (button.firstChild) label.appendChild(button.firstChild);

  const fill = document.createElement("span");
  fill.className = "origin-fill";
  fill.setAttribute("aria-hidden", "true");

  button.appendChild(fill);
  button.appendChild(label);
  button.dataset.originReady = "true";
  return fill;
}

/**
 * Applies the effect to every element matching `selector` within `scope`.
 * Returns a teardown that removes the listeners; the injected markup is harmless
 * and is discarded with the host when the view is rebuilt.
 */
export function bindOriginButtons(scope: HTMLElement, selector: string): () => void {
  if (prefersReducedMotion()) return () => {};

  const cleanups: Array<() => void> = [];

  scope.querySelectorAll<HTMLElement>(selector).forEach((button) => {
    const fill = prepare(button);
    if (!fill) return;

    const open = (x: number, y: number): void => {
      const rect = button.getBoundingClientRect();
      const size = coverDiameter(rect.width, rect.height, x, y);
      fill.style.width = `${size}px`;
      fill.style.height = `${size}px`;
      fill.style.left = `${x}px`;
      fill.style.top = `${y}px`;
      button.classList.add("origin-on");
    };
    const close = (): void => button.classList.remove("origin-on");

    const onEnter = (event: PointerEvent): void => {
      const rect = button.getBoundingClientRect();
      open(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onDown = (event: PointerEvent): void => {
      const rect = button.getBoundingClientRect();
      open(event.clientX - rect.left, event.clientY - rect.top);
    };
    // No cursor to originate from, so the centre is the truthful origin.
    const onFocus = (): void => {
      if (!button.matches(":focus-visible")) return;
      const rect = button.getBoundingClientRect();
      open(rect.width / 2, rect.height / 2);
    };

    button.addEventListener("pointerenter", onEnter);
    button.addEventListener("pointerdown", onDown);
    button.addEventListener("pointerleave", close);
    button.addEventListener("focus", onFocus);
    button.addEventListener("blur", close);

    cleanups.push(() => {
      button.removeEventListener("pointerenter", onEnter);
      button.removeEventListener("pointerdown", onDown);
      button.removeEventListener("pointerleave", close);
      button.removeEventListener("focus", onFocus);
      button.removeEventListener("blur", close);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}


/**
 * The same origin fill for the workstation's header buttons.
 *
 * Those buttons already carry a flood element (`.hb-dot`) that expanded from a fixed
 * point at 20%/40%. Rather than wrap their markup the way `bindOriginButtons` does --
 * which would disturb the label layers they are built from -- this drives that
 * existing element from the pointer instead, so the flood starts where the cursor
 * entered. Position and size travel as custom properties; the stylesheet owns the
 * growth.
 *
 * Disabled state is checked on every enter, not once at bind time: most of these
 * buttons are disabled until a file is open and become enabled later.
 */
export function bindOriginFlood(scope: HTMLElement, selector: string): () => void {
  if (prefersReducedMotion()) return () => {};

  const cleanups: Array<() => void> = [];

  scope.querySelectorAll<HTMLElement>(selector).forEach((button) => {
    const place = (x: number, y: number): void => {
      if (button.matches(":disabled")) return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--dot-x", `${x}px`);
      button.style.setProperty("--dot-y", `${y}px`);
      button.style.setProperty("--dot-size", `${coverDiameter(rect.width, rect.height, x, y)}px`);
    };

    const onEnter = (event: PointerEvent): void => {
      const rect = button.getBoundingClientRect();
      place(event.clientX - rect.left, event.clientY - rect.top);
    };
    // Focus has no cursor, so the centre is the truthful origin.
    const onFocus = (): void => {
      if (!button.matches(":focus-visible")) return;
      const rect = button.getBoundingClientRect();
      place(rect.width / 2, rect.height / 2);
    };

    button.addEventListener("pointerenter", onEnter);
    button.addEventListener("focus", onFocus);
    cleanups.push(() => {
      button.removeEventListener("pointerenter", onEnter);
      button.removeEventListener("focus", onFocus);
      button.style.removeProperty("--dot-x");
      button.style.removeProperty("--dot-y");
      button.style.removeProperty("--dot-size");
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
