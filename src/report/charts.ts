import type { jsPDF } from "jspdf";
import type { EntropyRegion, PeSection } from "../types";

/**
 * Vector chart primitives for the PDF dossier.
 *
 * Everything is drawn with jsPDF path operations rather than rasterised images, so
 * the output stays sharp at any zoom level and adds only a few kilobytes per chart.
 */

export type Rgb = readonly [number, number, number];

export const REPORT_PALETTE = {
  ink: [17, 24, 33] as Rgb,
  body: [55, 65, 81] as Rgb,
  muted: [107, 122, 140] as Rgb,
  faint: [156, 170, 186] as Rgb,
  hairline: [214, 224, 234] as Rgb,
  panel: [243, 247, 251] as Rgb,
  panelEdge: [223, 232, 241] as Rgb,
  white: [255, 255, 255] as Rgb,
  navy: [15, 32, 51] as Rgb,
  navySoft: [30, 55, 82] as Rgb,
  accent: [32, 126, 196] as Rgb,
  accentSoft: [219, 236, 249] as Rgb,
  critical: [176, 32, 45] as Rgb,
  high: [199, 88, 20] as Rgb,
  medium: [176, 137, 15] as Rgb,
  low: [42, 118, 168] as Rgb,
  info: [110, 126, 143] as Rgb,
  success: [22, 122, 80] as Rgb
} as const;

export const SEVERITY_COLOR: Record<string, Rgb> = {
  critical: REPORT_PALETTE.critical,
  high: REPORT_PALETTE.high,
  medium: REPORT_PALETTE.medium,
  low: REPORT_PALETTE.low,
  info: REPORT_PALETTE.info
};

export function bandColor(band: string): Rgb {
  switch (band) {
    case "Critical": return REPORT_PALETTE.critical;
    case "High": return REPORT_PALETTE.high;
    case "Elevated": return [186, 116, 18];
    case "Moderate": return REPORT_PALETTE.medium;
    case "Low": return REPORT_PALETTE.low;
    default: return REPORT_PALETTE.success;
  }
}

export function setFill(doc: jsPDF, color: Rgb): void { doc.setFillColor(color[0], color[1], color[2]); }
export function setDraw(doc: jsPDF, color: Rgb): void { doc.setDrawColor(color[0], color[1], color[2]); }
export function setText(doc: jsPDF, color: Rgb): void { doc.setTextColor(color[0], color[1], color[2]); }

/** Linear blend between two colours; `t` runs 0 → 1. */
export function mix(from: Rgb, to: Rgb, t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(from[0] + (to[0] - from[0]) * clamped),
    Math.round(from[1] + (to[1] - from[1]) * clamped),
    Math.round(from[2] + (to[2] - from[2]) * clamped)
  ];
}

/** Entropy 0 → 8 mapped onto a calm-to-alarming ramp. */
export function entropyColor(entropy: number): Rgb {
  const t = Math.max(0, Math.min(1, entropy / 8));
  if (t < 0.5) return mix([52, 122, 183], [176, 150, 26], t / 0.5);
  return mix([176, 150, 26], [176, 40, 40], (t - 0.5) / 0.5);
}

/**
 * Fills the wedge between two radii as a fan of triangles. jsPDF exposes no arc
 * primitive, so a segmented approximation is used; 2° steps are indistinguishable
 * from a true curve at print resolution.
 */
function drawAnnulusSegment(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  color: Rgb
): void {
  const steps = Math.max(2, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 90)));
  setFill(doc, color);
  for (let step = 0; step < steps; step += 1) {
    const a0 = startAngle + ((endAngle - startAngle) * step) / steps;
    const a1 = startAngle + ((endAngle - startAngle) * (step + 1)) / steps;
    const outerX0 = centerX + Math.cos(a0) * outerRadius;
    const outerY0 = centerY + Math.sin(a0) * outerRadius;
    const outerX1 = centerX + Math.cos(a1) * outerRadius;
    const outerY1 = centerY + Math.sin(a1) * outerRadius;
    const innerX0 = centerX + Math.cos(a0) * innerRadius;
    const innerY0 = centerY + Math.sin(a0) * innerRadius;
    const innerX1 = centerX + Math.cos(a1) * innerRadius;
    const innerY1 = centerY + Math.sin(a1) * innerRadius;
    doc.triangle(outerX0, outerY0, outerX1, outerY1, innerX0, innerY0, "F");
    doc.triangle(outerX1, outerY1, innerX1, innerY1, innerX0, innerY0, "F");
  }
}

/**
 * Semicircular risk gauge: a 180° track with the score sweep drawn over it, the
 * numeric score in the middle, and the band name underneath.
 */
export function drawRiskGauge(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  radius: number,
  score: number,
  band: string,
  options: { onDark?: boolean } = {}
): void {
  const inner = radius * 0.63;
  const start = Math.PI;
  const end = Math.PI * 2;
  const track: Rgb = options.onDark ? [46, 68, 92] : [226, 233, 240];

  drawAnnulusSegment(doc, centerX, baselineY, inner, radius, start, end, track);

  const sweepEnd = start + (end - start) * Math.max(0, Math.min(100, score)) / 100;
  if (score > 0) drawAnnulusSegment(doc, centerX, baselineY, inner, radius, start, sweepEnd, bandColor(band));

  // Tick marks at each 25% of the scale.
  setDraw(doc, options.onDark ? [78, 103, 130] : [198, 210, 222]);
  doc.setLineWidth(0.7);
  for (let tick = 0; tick <= 4; tick += 1) {
    const angle = start + ((end - start) * tick) / 4;
    doc.line(
      centerX + Math.cos(angle) * (inner - 3),
      baselineY + Math.sin(angle) * (inner - 3),
      centerX + Math.cos(angle) * (inner - 0.5),
      baselineY + Math.sin(angle) * (inner - 0.5)
    );
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(radius * 0.58);
  setText(doc, options.onDark ? REPORT_PALETTE.white : REPORT_PALETTE.ink);
  doc.text(String(Math.round(score)), centerX, baselineY - radius * 0.1, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, options.onDark ? [160, 186, 210] : REPORT_PALETTE.muted);
  doc.text("/ 100", centerX, baselineY - radius * 0.1 + 10, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, bandColor(band));
  doc.text(band.toUpperCase(), centerX, baselineY + 15, { align: "center" });
}

/**
 * Entropy profile across the file. Regions are bucketed down to the available pixel
 * width, keeping the maximum of each bucket so that narrow high-entropy spikes stay
 * visible rather than being averaged away.
 */
export function drawEntropyChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  regions: EntropyRegion[],
  fileSize: number
): void {
  setFill(doc, REPORT_PALETTE.panel);
  setDraw(doc, REPORT_PALETTE.panelEdge);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, height, "FD");

  if (regions.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, REPORT_PALETTE.muted);
    doc.text("No entropy windows were measured.", x + width / 2, y + height / 2, { align: "center" });
    return;
  }

  const plotLeft = x + 26;
  const plotRight = x + width - 8;
  const plotTop = y + 10;
  const plotBottom = y + height - 18;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Horizontal gridlines every 2 bits, plus the two suspicion thresholds.
  doc.setLineWidth(0.35);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  for (let value = 0; value <= 8; value += 2) {
    const gridY = plotBottom - (value / 8) * plotHeight;
    setDraw(doc, REPORT_PALETTE.hairline);
    doc.line(plotLeft, gridY, plotRight, gridY);
    setText(doc, REPORT_PALETTE.faint);
    doc.text(String(value), plotLeft - 4, gridY + 2, { align: "right" });
  }

  const buckets = Math.max(1, Math.min(Math.floor(plotWidth), 260));
  const perBucket = regions.length / buckets;
  const points: Array<{ px: number; py: number; entropy: number }> = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = Math.floor(bucket * perBucket);
    const to = Math.max(from + 1, Math.floor((bucket + 1) * perBucket));
    let peak = 0;
    for (let index = from; index < to && index < regions.length; index += 1) {
      peak = Math.max(peak, regions[index]?.entropy ?? 0);
    }
    points.push({
      px: plotLeft + (plotWidth * bucket) / Math.max(1, buckets - 1),
      py: plotBottom - (Math.min(8, peak) / 8) * plotHeight,
      entropy: peak
    });
  }

  // Area fill: one thin vertical bar per sample, tinted by its own entropy value.
  for (const point of points) {
    const barWidth = Math.max(0.6, plotWidth / buckets);
    setFill(doc, mix(entropyColor(point.entropy), REPORT_PALETTE.white, 0.55));
    doc.rect(point.px, point.py, barWidth, plotBottom - point.py, "F");
  }

  // Trace line on top of the fill.
  doc.setLineWidth(0.7);
  setDraw(doc, REPORT_PALETTE.navySoft);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    doc.line(previous.px, previous.py, current.px, current.py);
  }

  // Suspicion thresholds.
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([2, 2], 0);
  for (const [threshold, color] of [[7.75, REPORT_PALETTE.critical], [7.35, REPORT_PALETTE.high]] as Array<[number, Rgb]>) {
    const lineY = plotBottom - (threshold / 8) * plotHeight;
    setDraw(doc, color);
    doc.line(plotLeft, lineY, plotRight, lineY);
    setText(doc, color);
    doc.setFontSize(5.5);
    doc.text(threshold.toFixed(2), plotRight - 1, lineY - 1.5, { align: "right" });
  }
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setText(doc, REPORT_PALETTE.muted);
  doc.text("bits/byte", x + 4, y + 8);
  doc.text("0x0", plotLeft, plotBottom + 9);
  doc.text(`0x${Math.max(0, fileSize - 1).toString(16).toUpperCase()}`, plotRight, plotBottom + 9, { align: "right" });
}

/** 256-bar byte frequency distribution with ASCII/control/high-byte guides. */
export function drawByteHistogram(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  histogram: number[]
): void {
  setFill(doc, REPORT_PALETTE.panel);
  setDraw(doc, REPORT_PALETTE.panelEdge);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, height, "FD");

  const total = histogram.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, REPORT_PALETTE.muted);
    doc.text("File contains no bytes.", x + width / 2, y + height / 2, { align: "center" });
    return;
  }

  const plotLeft = x + 8;
  const plotRight = x + width - 8;
  const plotTop = y + 10;
  const plotBottom = y + height - 14;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const peak = Math.max(...histogram);
  const barWidth = plotWidth / 256;

  for (let value = 0; value < 256; value += 1) {
    const count = histogram[value] ?? 0;
    if (count === 0) continue;
    // Square-root scaling keeps low-frequency bytes legible next to a dominant value.
    const barHeight = Math.max(0.4, (Math.sqrt(count) / Math.sqrt(peak)) * plotHeight);
    const color: Rgb = value === 0 ? [120, 132, 146]
      : value < 32 ? [150, 120, 175]
      : value < 127 ? REPORT_PALETTE.accent
      : value === 255 ? [120, 132, 146]
      : [196, 122, 52];
    setFill(doc, color);
    doc.rect(plotLeft + value * barWidth, plotBottom - barHeight, Math.max(0.5, barWidth * 0.86), barHeight, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  setText(doc, REPORT_PALETTE.faint);
  for (const [value, label] of [[0, "0x00"], [64, "0x40"], [128, "0x80"], [192, "0xC0"], [255, "0xFF"]] as Array<[number, string]>) {
    doc.text(label, plotLeft + value * barWidth, plotBottom + 8, { align: value === 255 ? "right" : value === 0 ? "left" : "center" });
  }
  setText(doc, REPORT_PALETTE.muted);
  doc.setFontSize(6);
  doc.text(`peak ${peak.toLocaleString()} occurrences`, plotRight, y + 8, { align: "right" });
}

/** Proportional PE section map, each block tinted by that section's entropy. */
export function drawSectionMap(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  sections: PeSection[]
): void {
  if (sections.length === 0) return;
  const total = sections.reduce((sum, section) => sum + Math.max(1, section.rawSize), 0);
  let cursor = x;

  for (const section of sections) {
    const blockWidth = Math.max(6, (Math.max(1, section.rawSize) / total) * width);
    const entropy = section.entropy ?? 0;
    setFill(doc, entropyColor(entropy));
    doc.rect(cursor, y, blockWidth, height, "F");

    const executable = (section.characteristics & 0x20000000) !== 0;
    const writable = (section.characteristics & 0x80000000) !== 0;
    if (executable && writable) {
      // Hatch W+X sections so they remain distinguishable in greyscale printing.
      setDraw(doc, REPORT_PALETTE.white);
      doc.setLineWidth(0.6);
      for (let offset = 0; offset < blockWidth + height; offset += 4) {
        const x1 = cursor + offset;
        const y1 = y;
        const x2 = cursor + offset - height;
        const y2 = y + height;
        doc.line(Math.min(x1, cursor + blockWidth), y1 + Math.max(0, x1 - (cursor + blockWidth)), Math.max(x2, cursor), y2 - Math.max(0, cursor - x2));
      }
    }

    setDraw(doc, REPORT_PALETTE.white);
    doc.setLineWidth(0.8);
    doc.rect(cursor, y, blockWidth, height, "S");

    if (blockWidth > 26) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      setText(doc, entropy > 5.5 ? REPORT_PALETTE.white : REPORT_PALETTE.ink);
      doc.text(section.name.slice(0, 9), cursor + blockWidth / 2, y + height / 2 + 2, { align: "center" });
    }
    cursor += blockWidth;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  setText(doc, REPORT_PALETTE.muted);
  doc.text("Block width ∝ raw size · fill colour ∝ section entropy · white hatching marks writable+executable sections", x, y + height + 8);
}

/** Horizontal bar chart of category contributions to the composite threat score. */
export function drawCategoryBars(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  entries: Array<{ label: string; value: number }>,
  maxValue: number
): number {
  const rowHeight = 14;
  const labelWidth = 118;
  doc.setFontSize(7.5);

  entries.forEach((entry, index) => {
    const rowY = y + index * rowHeight;
    doc.setFont("helvetica", "normal");
    setText(doc, REPORT_PALETTE.body);
    doc.text(entry.label, x, rowY + 7);

    const trackX = x + labelWidth;
    const trackWidth = width - labelWidth - 30;
    setFill(doc, [232, 238, 244]);
    doc.roundedRect(trackX, rowY + 1.5, trackWidth, 7, 1.5, 1.5, "F");

    const ratio = maxValue > 0 ? Math.max(0, Math.min(1, entry.value / maxValue)) : 0;
    if (ratio > 0) {
      setFill(doc, mix(REPORT_PALETTE.accent, REPORT_PALETTE.critical, ratio));
      doc.roundedRect(trackX, rowY + 1.5, Math.max(2, trackWidth * ratio), 7, 1.5, 1.5, "F");
    }

    doc.setFont("helvetica", "bold");
    setText(doc, REPORT_PALETTE.ink);
    doc.text(entry.value.toFixed(1), x + width, rowY + 7, { align: "right" });
  });

  return entries.length * rowHeight;
}

/** Stacked proportional bar summarising how many findings fell into each severity. */
export function drawSeverityStrip(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  counts: Array<{ severity: string; count: number }>
): void {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) {
    setFill(doc, [232, 238, 244]);
    doc.roundedRect(x, y, width, height, 2, 2, "F");
    return;
  }
  let cursor = x;
  counts.forEach((entry) => {
    if (entry.count === 0) return;
    const segmentWidth = (entry.count / total) * width;
    setFill(doc, SEVERITY_COLOR[entry.severity] ?? REPORT_PALETTE.info);
    doc.rect(cursor, y, segmentWidth, height, "F");
    if (segmentWidth > 18) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      setText(doc, REPORT_PALETTE.white);
      doc.text(String(entry.count), cursor + segmentWidth / 2, y + height / 2 + 2.2, { align: "center" });
    }
    cursor += segmentWidth;
  });
}
