/**
 * Hero motion.
 *
 * Two effects, both restrained: the headline resolves character by character, and the
 * call-to-action buttons lean slightly toward the cursor.
 *
 * Both use GSAP, which the project already depends on for the navigation overlay.
 * That is deliberate -- the obvious alternatives here (AOS, ScrollReveal, Motion One)
 * are scroll-triggered, and this landing deliberately fits one screen and never
 * scrolls, so they would have nothing to fire on while adding a second animation
 * runtime. SplitText is GSAP's own splitter and ships free with 3.13 onward, so the
 * character reveal costs no new dependency either.
 *
 * The headline keeps the per-line masks it already had. Those exist because the
 * element that sizes the headline cannot hide its overflow without collapsing under
 * height pressure, and that fix is not worth trading for an animation.
 */

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

/** Evaluated on use, not at import: this module is also loaded in a plain Node test run. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How far a magnetic control may travel, in pixels. Small enough to read as a lean. */
const MAGNET_RANGE = 7;

/**
 * Splits the headline into characters and raises them on a stagger.
 *
 * Each line is split separately so the existing line masks still clip the motion, and
 * the characters travel less than their own height -- a full-height rise reads as a
 * slot machine rather than as type settling.
 */
function revealHeadline(headline: HTMLElement): () => void {
  const lines = [...headline.querySelectorAll<HTMLElement>(".line-inner")];
  if (!lines.length) return () => {};

  // Hands the reveal to GSAP; the stylesheet's own entrance stands down.
  headline.classList.add("is-split");

  const splits = lines.map((line) => new SplitText(line, { type: "chars" }));
  const timeline = gsap.timeline();

  /*
   * A watchdog on a timer rather than a frame.
   *
   * `fromTo` writes the hidden state immediately and relies on the ticker to undo it,
   * and the ticker runs on requestAnimationFrame -- which browsers throttle or pause
   * outright in a background tab. A page opened in one and read later would otherwise
   * show a headline stranded part-way through its reveal. setTimeout keeps running
   * there, so this guarantees the reveal always ends where it should.
   */
  const watchdog = setTimeout(() => {
    if (timeline.progress() < 1) timeline.progress(1);
  }, 2600);

  /*
   * The start state is written synchronously rather than left to `fromTo`.
   *
   * A tween placed later than the playhead only applies its from-values on the
   * timeline's first render, so if the watchdog above fires first the reveal is skipped
   * entirely. Setting it here means the characters are always hidden before there is
   * anything to reveal, whatever the ticker does.
   */
  const allChars = splits.flatMap((split) => split.chars);
  gsap.set(allChars, { yPercent: 60, opacity: 0 });

  splits.forEach((split, index) => {
    timeline.to(
      split.chars,
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.62,
        ease: "power3.out",
        // Fast enough that the line still reads as one phrase.
        stagger: 0.022
      },
      index * 0.16
    );
  });

  return () => {
    clearTimeout(watchdog);
    timeline.kill();
    // revert() puts the original text nodes back, so the DOM is left as it was found.
    splits.forEach((split) => split.revert());
    headline.classList.remove("is-split");
  };
}

/**
 * Makes a control lean toward the pointer while it is over it.
 *
 * Transform only, so nothing around the button reflows, and the travel is capped well
 * inside the control's own padding so the label never approaches its edge.
 */
function magnetise(button: HTMLElement): () => void {
  const label = button.querySelector<HTMLElement>(".origin-label") ?? button;

  const onMove = (event: PointerEvent): void => {
    const rect = button.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    gsap.to(button, {
      x: dx * MAGNET_RANGE,
      y: dy * MAGNET_RANGE,
      duration: 0.4,
      ease: "power3.out",
      overwrite: "auto"
    });
    // The label trails the button slightly, which is what sells the pull.
    gsap.to(label, {
      x: dx * MAGNET_RANGE * 0.35,
      y: dy * MAGNET_RANGE * 0.35,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto"
    });
  };

  const onLeave = (): void => {
    gsap.to([button, label], {
      x: 0,
      y: 0,
      duration: 0.55,
      ease: "elastic.out(1, 0.45)",
      overwrite: "auto"
    });
  };

  button.addEventListener("pointermove", onMove);
  button.addEventListener("pointerleave", onLeave);

  return () => {
    button.removeEventListener("pointermove", onMove);
    button.removeEventListener("pointerleave", onLeave);
    gsap.set([button, label], { clearProps: "transform" });
  };
}

/**
 * Starts both effects within `scope`.
 * Returns a teardown that restores the DOM and removes every listener.
 */
export function startHeroMotion(scope: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const stops: Array<() => void> = [];

  const headline = scope.querySelector<HTMLElement>(".headline");
  if (headline) stops.push(revealHeadline(headline));

  // Pointer-driven lean is meaningless without a pointer, and on touch it would only
  // fire after the tap has already happened.
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    scope.querySelectorAll<HTMLElement>(".cta, .cta-ghost").forEach((button) => {
      stops.push(magnetise(button));
    });
  }

  return () => stops.forEach((stop) => stop());
}
