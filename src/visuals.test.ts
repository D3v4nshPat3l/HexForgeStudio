/**
 * Tests for the two interactive visuals.
 *
 * Both are canvas effects driven by an animation frame, which makes them awkward to
 * confirm by eye and impossible to confirm in a headless run. The parts that carry the
 * behaviour are therefore plain functions over plain arrays, and those are what these
 * tests exercise: ignition, decay, the speed response, and the geometry that decides
 * how far a button's fill has to grow.
 */

import { describe, expect, it } from "vitest";
import { advanceEnergy } from "./constellation";
import { coverDiameter } from "./ui/origin-button";

const COLS = 20;
const ROWS = 12;
const PITCH = 30;

function blank(): Float32Array {
  return new Float32Array(COLS * ROWS);
}
function at(energy: Float32Array, col: number, row: number): number {
  return energy[row * COLS + col] ?? 0;
}

describe("constellation mesh", () => {
  it("lights dots under the pointer and leaves distant ones dark", () => {
    const energy = blank();
    // Pointer sitting exactly on the dot at column 5, row 5.
    advanceEnergy(energy, COLS, ROWS, { x: 5 * PITCH, y: 5 * PITCH, inside: true }, 0);

    expect(at(energy, 5, 5)).toBeGreaterThan(0);
    // A dot well outside the influence radius must stay untouched.
    expect(at(energy, 19, 11)).toBe(0);
  });

  it("falls off with distance from the pointer", () => {
    const energy = blank();
    advanceEnergy(energy, COLS, ROWS, { x: 5 * PITCH, y: 5 * PITCH, inside: true }, 0);

    const near = at(energy, 5, 5);
    const mid = at(energy, 7, 5);
    const far = at(energy, 9, 5);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("decays to nothing once the pointer leaves", () => {
    const energy = blank();
    advanceEnergy(energy, COLS, ROWS, { x: 5 * PITCH, y: 5 * PITCH, inside: true }, 0);
    expect(at(energy, 5, 5)).toBeGreaterThan(0);

    let live = 1;
    // Decay is 0.9 per frame from at most 0.85, so this is ample headroom.
    for (let i = 0; i < 200; i++) {
      live = advanceEnergy(energy, COLS, ROWS, { x: 0, y: 0, inside: false }, 0);
    }
    expect(live).toBe(0);
    expect(at(energy, 5, 5)).toBe(0);
  });

  it("hits harder and reaches further at speed -- the shockwave", () => {
    const slow = blank();
    const fast = blank();
    const pointer = { x: 5 * PITCH, y: 5 * PITCH, inside: true };

    advanceEnergy(slow, COLS, ROWS, pointer, 0);
    advanceEnergy(fast, COLS, ROWS, pointer, 60);

    // Harder at the centre.
    expect(at(fast, 5, 5)).toBeGreaterThan(at(slow, 5, 5));
    // And further out: a dot beyond the resting reach only lights on a fast sweep.
    expect(at(slow, 10, 5)).toBe(0);
    expect(at(fast, 10, 5)).toBeGreaterThan(0);
  });

  it("never exceeds the ceiling that keeps it behind the interface", () => {
    const energy = blank();
    for (let i = 0; i < 60; i++) {
      advanceEnergy(energy, COLS, ROWS, { x: 5 * PITCH, y: 5 * PITCH, inside: true }, 90);
    }
    // Float32Array stores 0.85 as 0.85000002…, so the comparison carries that epsilon
    // rather than pretending the ceiling is exact in single precision.
    for (const value of energy) expect(value).toBeLessThanOrEqual(0.85 + 1e-6);
  });

  it("reports how many dots are lit so an idle mesh can stop repainting", () => {
    const energy = blank();
    expect(advanceEnergy(energy, COLS, ROWS, { x: 0, y: 0, inside: false }, 0)).toBe(0);
    expect(advanceEnergy(energy, COLS, ROWS, { x: 60, y: 60, inside: true }, 0)).toBeGreaterThan(0);
  });
});

describe("origin button geometry", () => {
  it("covers the box from a corner origin", () => {
    // From (0, 0) the far corner of a 100x100 box is at distance sqrt(20000) ~= 141.4,
    // so the disc needs a diameter of twice that.
    expect(coverDiameter(100, 100, 0, 0)).toBe(283);
  });

  it("covers the box from the centre", () => {
    // From the centre every corner is sqrt(5000) ~= 70.7 away.
    expect(coverDiameter(100, 100, 50, 50)).toBe(142);
  });

  it("always reaches the furthest corner, wherever it starts", () => {
    const width = 220;
    const height = 48;
    for (const [x, y] of [[0, 0], [220, 0], [0, 48], [220, 48], [110, 24], [17, 41]]) {
      const radius = coverDiameter(width, height, x!, y!) / 2;
      const furthest = Math.max(
        Math.hypot(x!, y!),
        Math.hypot(width - x!, y!),
        Math.hypot(x!, height - y!),
        Math.hypot(width - x!, height - y!)
      );
      expect(radius).toBeGreaterThanOrEqual(furthest);
    }
  });
});
