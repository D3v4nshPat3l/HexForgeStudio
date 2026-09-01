/**
 * Constellation mesh.
 *
 * A dot grid that answers the pointer: dots near the cursor light and swell, and the
 * faster the sweep the wider and hotter the wake, so a quick drag across the panel
 * throws a shockwave rather than a dot.
 *
 * This sits behind the workstation's content. Two rules follow from that and shape
 * the whole file: it must never compete with hex for attention, and it must never
 * cost frames the editor needs. So the mesh idles at zero work when the pointer is
 * away, its energy is bounded well below full brightness, and it draws nothing at all
 * while a file is open and the byte grid is on screen.
 */

/** Evaluated on use, not at import: this module is also loaded in a plain Node test run. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Grid pitch in CSS pixels. Larger is cheaper and reads as calmer. */
const PITCH = 30;
const INFLUENCE = 132;
/** Ceiling on a dot's energy, keeping the mesh subordinate to the interface. */
const MAX_ENERGY = 0.85;

export interface MeshPointer {
  x: number;
  y: number;
  inside: boolean;
}

/**
 * Advances the mesh one frame, in place.
 *
 * Pure apart from the array it writes, so the behaviour that matters -- ignition near
 * the pointer, decay once it leaves, and a wider harder hit at speed -- is testable
 * without a canvas or an animation frame.
 *
 * Returns the number of dots still carrying energy, which the caller uses to decide
 * whether a repaint is worth doing at all.
 */
export function advanceEnergy(
  energy: Float32Array,
  cols: number,
  rows: number,
  pointer: MeshPointer,
  speed: number
): number {
  const reach = INFLUENCE * (1 + Math.min(speed / 26, 1.5));
  const force = 0.16 + Math.min(speed / 34, 1) * 0.72;
  let live = 0;

  for (let row = 0; row < rows; row++) {
    const y = row * PITCH;
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      let value = (energy[index] ?? 0) * 0.9;
      if (pointer.inside) {
        const distance = Math.hypot(col * PITCH - pointer.x, y - pointer.y);
        if (distance < reach) {
          const falloff = 1 - distance / reach;
          value = Math.min(MAX_ENERGY, Math.max(value, falloff * falloff * force));
        }
      }
      const settled = value < 0.004 ? 0 : value;
      energy[index] = settled;
      if (settled > 0) live++;
    }
  }
  return live;
}

export function startConstellation(canvas: HTMLCanvasElement, host: HTMLElement): () => void {
  const context2d = canvas.getContext("2d", { alpha: true });
  if (!context2d || prefersReducedMotion()) return () => {};
  // Bind a non-null local: the narrowing above is not carried into the draw closures.
  const context: CanvasRenderingContext2D = context2d;

  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let energy = new Float32Array(0);

  let pointerX = -9999;
  let pointerY = -9999;
  let lastX = -9999;
  let lastY = -9999;
  /** Pointer speed in px/frame, smoothed; drives the shockwave. */
  let speed = 0;
  let inside = false;
  let running = true;
  let idleFrames = 0;

  function resize(): void {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / PITCH) + 1;
    rows = Math.ceil(height / PITCH) + 1;
    energy = new Float32Array(cols * rows);
  }

  function onMove(event: PointerEvent): void {
    const rect = host.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    inside = true;
    idleFrames = 0;
  }
  function onLeave(): void {
    inside = false;
    pointerX = -9999;
    pointerY = -9999;
  }

  function step(): void {
    if (lastX > -9000 && inside) {
      const moved = Math.hypot(pointerX - lastX, pointerY - lastY);
      // Smooth so a single jumpy sample cannot flash the whole mesh.
      speed += (Math.min(moved, 90) - speed) * 0.25;
    } else {
      speed *= 0.9;
    }
    lastX = pointerX;
    lastY = pointerY;

    const live = advanceEnergy(energy, cols, rows, { x: pointerX, y: pointerY, inside }, speed);
    // Nothing lit and no pointer: stop drawing entirely rather than spin.
    idleFrames = live === 0 && !inside ? idleFrames + 1 : 0;
  }

  function draw(): void {
    context.clearRect(0, 0, width, height);
    for (let row = 0; row < rows; row++) {
      const y = row * PITCH;
      for (let col = 0; col < cols; col++) {
        const e = energy[row * cols + col] ?? 0;
        const x = col * PITCH;
        if (e <= 0) {
          // Resting mesh: barely there, just enough to imply the grid.
          context.fillStyle = "rgba(196, 181, 253, 0.13)";
          context.fillRect(x, y, 1.6, 1.6);
          continue;
        }
        const size = 1 + e * 3.4;
        context.fillStyle = `rgba(196, 181, 253, ${(0.12 + e * 0.72).toFixed(3)})`;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();

        if (e > 0.5) {
          const bloom = context.createRadialGradient(x, y, 0, x, y, size * 5);
          bloom.addColorStop(0, `rgba(167, 139, 250, ${(e * 0.22).toFixed(3)})`);
          bloom.addColorStop(1, "rgba(167, 139, 250, 0)");
          context.fillStyle = bloom;
          context.beginPath();
          context.arc(x, y, size * 5, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  let raf = 0;
  function loop(): void {
    if (!running) return;
    step();
    // Idle costs one comparison per frame instead of a full repaint.
    if (idleFrames < 3) draw();
    raf = requestAnimationFrame(loop);
  }

  resize();
  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  draw();
  loop();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
  };
}
