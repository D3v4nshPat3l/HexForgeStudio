import { jsPDF } from "jspdf";
import type { CapabilityHit, FileAnalysis, IocItem, Severity, ThreatFinding } from "../types";
import { summarizeCapabilities } from "../analyzers/capabilities";
import {
  bandColor,
  drawByteHistogram,
  drawCategoryBars,
  drawEntropyChart,
  drawRiskGauge,
  drawSectionMap,
  drawSeverityStrip,
  entropyColor,
  REPORT_PALETTE,
  SEVERITY_COLOR,
  setDraw,
  setFill,
  setText,
  type Rgb
} from "./charts";

export interface PdfReportOptions {
  title?: string;
  userNotes?: string;
  includeStrings?: number;
  includeSignatures?: number;
  includeEntropyRegions?: number;
  includeIocs?: number;
  includeCapabilities?: number;
  analystName?: string;
  caseId?: string;
  organization?: string;
  evidenceNumber?: string;
  acquisitionMethod?: string;
  classification?: string;
  hexExcerpt?: { offset: number; bytes: number[] } | undefined;
}

const MARGIN = 46;
const FOOTER_HEIGHT = 34;
const HEADER_HEIGHT = 26;

interface SectionRef {
  title: string;
  page: number;
  level: number;
}

/**
 * Page-aware document writer.
 *
 * Content is emitted top-to-bottom; every primitive reserves its height first so a
 * section never straddles a page break mid-row. Headers, footers, and the table of
 * contents are stamped in a final pass once the true page count is known.
 */
class Dossier {
  readonly doc: jsPDF;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
  readonly sections: SectionRef[] = [];
  y = 0;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - MARGIN * 2;
  }

  get bottomLimit(): number { return this.pageHeight - FOOTER_HEIGHT - 10; }
  get page(): number { return this.doc.internal.pages.length - 1; }

  newPage(): void {
    this.doc.addPage();
    this.y = MARGIN + HEADER_HEIGHT;
  }

  ensure(height: number): void {
    if (this.y + height > this.bottomLimit) this.newPage();
  }

  /** Registers a heading in the table of contents and draws its rule. */
  heading(title: string): void {
    this.ensure(46);
    this.sections.push({ title, page: this.page, level: 1 });
    setFill(this.doc, REPORT_PALETTE.navy);
    this.doc.rect(MARGIN, this.y - 2, 3, 15, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13.5);
    setText(this.doc, REPORT_PALETTE.ink);
    this.doc.text(title, MARGIN + 10, this.y + 10);
    this.y += 19;
    setDraw(this.doc, REPORT_PALETTE.hairline);
    this.doc.setLineWidth(0.6);
    this.doc.line(MARGIN, this.y, this.pageWidth - MARGIN, this.y);
    this.y += 15;
  }

  subheading(title: string): void {
    this.ensure(28);
    this.sections.push({ title, page: this.page, level: 2 });
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9.5);
    setText(this.doc, REPORT_PALETTE.navySoft);
    this.doc.text(title.toUpperCase(), MARGIN, this.y + 8);
    this.y += 17;
  }

  paragraph(text: string, options: { size?: number; color?: Rgb; italic?: boolean } = {}): void {
    const size = options.size ?? 8.5;
    const lines = this.doc.splitTextToSize(text, this.contentWidth) as string[];
    const lineHeight = size * 1.38;
    this.ensure(Math.min(lines.length, 3) * lineHeight + 6);
    this.doc.setFont("helvetica", options.italic ? "italic" : "normal");
    this.doc.setFontSize(size);
    setText(this.doc, options.color ?? REPORT_PALETTE.body);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.doc.text(line, MARGIN, this.y + size);
      this.y += lineHeight;
    }
    this.y += 6;
  }

  /** Label/value row with a monospaced value column. */
  field(label: string, value: string, options: { valueColor?: Rgb; labelWidth?: number } = {}): void {
    const labelWidth = options.labelWidth ?? 128;
    const wrapped = this.doc.splitTextToSize(value || "—", this.contentWidth - labelWidth) as string[];
    const height = Math.max(13, wrapped.length * 10.5 + 3);
    this.ensure(height);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.8);
    setText(this.doc, REPORT_PALETTE.muted);
    this.doc.text(label.toUpperCase(), MARGIN, this.y + 8);
    this.doc.setFont("courier", "normal");
    this.doc.setFontSize(8);
    setText(this.doc, options.valueColor ?? REPORT_PALETTE.ink);
    this.doc.text(wrapped, MARGIN + labelWidth, this.y + 8);
    this.y += height;
  }

  /** Tinted callout box used for interpretation notes and warnings. */
  callout(title: string, body: string, color: Rgb): void {
    const lines = this.doc.splitTextToSize(body, this.contentWidth - 26) as string[];
    const height = lines.length * 10 + 26;
    this.ensure(height + 6);
    setFill(this.doc, [
      Math.round(color[0] + (255 - color[0]) * 0.9),
      Math.round(color[1] + (255 - color[1]) * 0.9),
      Math.round(color[2] + (255 - color[2]) * 0.9)
    ]);
    this.doc.roundedRect(MARGIN, this.y, this.contentWidth, height, 3, 3, "F");
    setFill(this.doc, color);
    this.doc.rect(MARGIN, this.y, 3, height, "F");

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    setText(this.doc, color);
    this.doc.text(title.toUpperCase(), MARGIN + 13, this.y + 14);

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    setText(this.doc, REPORT_PALETTE.body);
    this.doc.text(lines, MARGIN + 13, this.y + 26);
    this.y += height + 10;
  }

  /**
   * Fixed-column table. Column widths are fractions of the content width; rows wrap
   * and repeat the header whenever they spill onto a new page.
   */
  table(
    columns: Array<{ label: string; width: number; mono?: boolean; align?: "left" | "right" }>,
    rows: Array<{ cells: string[]; accent?: Rgb }>,
    options: { emptyMessage?: string; maxRows?: number } = {}
  ): void {
    if (rows.length === 0) {
      this.ensure(28);
      setFill(this.doc, REPORT_PALETTE.panel);
      this.doc.roundedRect(MARGIN, this.y, this.contentWidth, 24, 2, 2, "F");
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(8);
      setText(this.doc, REPORT_PALETTE.muted);
      this.doc.text(options.emptyMessage ?? "No entries.", MARGIN + 10, this.y + 15);
      this.y += 32;
      return;
    }

    const widths = columns.map((column) => column.width * this.contentWidth);
    const drawHead = (): void => {
      this.ensure(20);
      setFill(this.doc, REPORT_PALETTE.navy);
      this.doc.rect(MARGIN, this.y, this.contentWidth, 15, "F");
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6.8);
      setText(this.doc, REPORT_PALETTE.white);
      let x = MARGIN + 6;
      columns.forEach((column, index) => {
        const width = widths[index] ?? 0;
        this.doc.text(column.label.toUpperCase(), column.align === "right" ? x + width - 12 : x, this.y + 10, column.align === "right" ? { align: "right" } : {});
        x += width;
      });
      this.y += 15;
    };

    drawHead();
    const limit = options.maxRows ?? rows.length;
    let striped = false;

    for (const row of rows.slice(0, limit)) {
      const wrapped = columns.map((column, index) => {
        this.doc.setFont(column.mono ? "courier" : "helvetica", "normal");
        this.doc.setFontSize(7.2);
        return this.doc.splitTextToSize(row.cells[index] ?? "", (widths[index] ?? 40) - 12) as string[];
      });
      const rowLines = Math.max(1, ...wrapped.map((lines) => lines.length));
      const rowHeight = rowLines * 9 + 6;

      if (this.y + rowHeight > this.bottomLimit) {
        this.newPage();
        drawHead();
        striped = false;
      }

      if (striped) {
        setFill(this.doc, [248, 250, 252]);
        this.doc.rect(MARGIN, this.y, this.contentWidth, rowHeight, "F");
      }
      if (row.accent) {
        setFill(this.doc, row.accent);
        this.doc.rect(MARGIN, this.y, 2.5, rowHeight, "F");
      }

      let x = MARGIN + 6;
      columns.forEach((column, index) => {
        const width = widths[index] ?? 0;
        this.doc.setFont(column.mono ? "courier" : "helvetica", "normal");
        this.doc.setFontSize(7.2);
        setText(this.doc, index === 0 && row.accent ? row.accent : REPORT_PALETTE.body);
        this.doc.text(wrapped[index] ?? [], column.align === "right" ? x + width - 12 : x, this.y + 9, column.align === "right" ? { align: "right" } : {});
        x += width;
      });

      setDraw(this.doc, [237, 242, 247]);
      this.doc.setLineWidth(0.4);
      this.doc.line(MARGIN, this.y + rowHeight, this.pageWidth - MARGIN, this.y + rowHeight);
      this.y += rowHeight;
      striped = !striped;
    }

    if (rows.length > limit) {
      this.y += 4;
      this.paragraph(`${(rows.length - limit).toLocaleString()} further row${rows.length - limit === 1 ? "" : "s"} omitted from this table. Export the corresponding CSV from the application for the complete set.`, { size: 7.2, color: REPORT_PALETTE.muted, italic: true });
    } else {
      this.y += 10;
    }
  }

  /** Compact grid of headline numbers. */
  statRow(stats: Array<{ label: string; value: string; color?: Rgb }>): void {
    const height = 42;
    this.ensure(height + 10);
    const gap = 8;
    const cardWidth = (this.contentWidth - gap * (stats.length - 1)) / stats.length;
    stats.forEach((stat, index) => {
      const x = MARGIN + index * (cardWidth + gap);
      setFill(this.doc, REPORT_PALETTE.panel);
      setDraw(this.doc, REPORT_PALETTE.panelEdge);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(x, this.y, cardWidth, height, 3, 3, "FD");
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6.2);
      setText(this.doc, REPORT_PALETTE.muted);
      this.doc.text(stat.label.toUpperCase(), x + 8, this.y + 13);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(cardWidth > 110 ? 14 : 11.5);
      setText(this.doc, stat.color ?? REPORT_PALETTE.ink);
      this.doc.text(stat.value, x + 8, this.y + 32);
    });
    this.y += height + 12;
  }
}

function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function hex(offset: number): string {
  return `0x${Math.max(0, Math.floor(offset)).toString(16).toUpperCase().padStart(8, "0")}`;
}

function sanitize(value: string, limit = 400): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E]/g, "·").slice(0, limit);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes.toLocaleString()} bytes`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(2)} ${units[index]} (${bytes.toLocaleString()} bytes)`;
}

// --- Cover page --------------------------------------------------------------

function drawCover(dossier: Dossier, analysis: FileAnalysis, options: PdfReportOptions): void {
  const { doc, pageWidth, pageHeight } = dossier;
  const threat = analysis.threat;

  setFill(doc, REPORT_PALETTE.navy);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Diagonal accent wash across the lower third.
  setFill(doc, [21, 44, 70]);
  doc.triangle(0, pageHeight, pageWidth, pageHeight * 0.58, pageWidth, pageHeight, "F");
  setFill(doc, [26, 54, 84]);
  doc.triangle(0, pageHeight, pageWidth, pageHeight * 0.74, 0, pageHeight * 0.86, "F");

  // Mark.
  setDraw(doc, [98, 178, 236]);
  doc.setLineWidth(2.4);
  const cx = MARGIN + 20;
  const cy = 76;
  doc.lines([[20, 11], [0, 23], [-20, 11], [-20, -11], [0, -23], [20, -11]], cx, cy - 23, [1, 1], "S", true);
  doc.setLineWidth(3.4);
  setDraw(doc, [190, 226, 248]);
  doc.line(cx - 8, cy - 11, cx - 8, cy + 11);
  doc.line(cx + 8, cy - 11, cx + 8, cy + 11);
  doc.line(cx - 8, cy, cx + 8, cy);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, REPORT_PALETTE.white);
  doc.text("HEXFORGE STUDIO PRO", MARGIN + 54, cy - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, [150, 184, 214]);
  doc.text("Local-first binary forensics workstation", MARGIN + 54, cy + 9);

  if (options.classification?.trim()) {
    const label = options.classification.trim().toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const width = doc.getTextWidth(label) + 18;
    setFill(doc, REPORT_PALETTE.critical);
    doc.roundedRect(pageWidth - MARGIN - width, cy - 16, width, 18, 2, 2, "F");
    setText(doc, REPORT_PALETTE.white);
    doc.text(label, pageWidth - MARGIN - width / 2, cy - 3.5, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  setText(doc, REPORT_PALETTE.white);
  const titleLines = doc.splitTextToSize(options.title ?? "Forensic Binary Analysis Dossier", dossier.contentWidth) as string[];
  let titleY = 168;
  for (const line of titleLines.slice(0, 3)) {
    doc.text(line, MARGIN, titleY);
    titleY += 34;
  }

  setDraw(doc, [72, 132, 184]);
  doc.setLineWidth(2);
  doc.line(MARGIN, titleY - 12, MARGIN + 90, titleY - 12);

  doc.setFont("courier", "normal");
  doc.setFontSize(12);
  setText(doc, [176, 210, 236]);
  doc.text(doc.splitTextToSize(analysis.filename, dossier.contentWidth) as string[], MARGIN, titleY + 14);

  // Risk gauge panel.
  const gaugeCenterX = pageWidth - MARGIN - 82;
  const gaugeBaseline = 400;
  setFill(doc, [20, 42, 66]);
  doc.roundedRect(gaugeCenterX - 108, gaugeBaseline - 118, 216, 172, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, [140, 176, 208]);
  doc.text("COMPOSITE THREAT SCORE", gaugeCenterX, gaugeBaseline - 100, { align: "center" });
  drawRiskGauge(doc, gaugeCenterX, gaugeBaseline, 74, threat.score, threat.band, { onDark: true });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setText(doc, [128, 162, 196]);
  doc.text(`${threat.findings.length} scored indicator${threat.findings.length === 1 ? "" : "s"}`, gaugeCenterX, gaugeBaseline + 32, { align: "center" });

  // Metadata block.
  const metadata: Array<[string, string]> = [
    ["Case / project", options.caseId?.trim() || "Not provided"],
    ["Evidence number", options.evidenceNumber?.trim() || "Not provided"],
    ["Examiner", options.analystName?.trim() || "Not provided"],
    ["Organization", options.organization?.trim() || "Not provided"],
    ["File size", formatSize(analysis.size)],
    ["Detected type", analysis.detectedType[0]?.name ?? "Unidentified"],
    ["SHA-256", analysis.hashes.find((item) => item.algorithm.toUpperCase().includes("SHA-256"))?.value ?? "Not calculated"],
    ["Analyzed", new Date(analysis.analyzedAt).toLocaleString()]
  ];

  let metaY = 322;
  for (const [label, value] of metadata) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    setText(doc, [116, 152, 186]);
    doc.text(label.toUpperCase(), MARGIN, metaY);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.6);
    setText(doc, [226, 238, 248]);
    const lines = doc.splitTextToSize(value, 270) as string[];
    doc.text(lines.slice(0, 2), MARGIN, metaY + 11);
    metaY += 11 + lines.slice(0, 2).length * 9 + 5;
  }

  // Summary strip.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, [196, 220, 240]);
  const summaryLines = doc.splitTextToSize(threat.summary, dossier.contentWidth) as string[];
  doc.text(summaryLines.slice(0, 4), MARGIN, pageHeight - 148);

  setDraw(doc, [58, 94, 130]);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, pageHeight - 86, pageWidth - MARGIN, pageHeight - 86);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  setText(doc, [128, 162, 196]);
  doc.text(
    "Generated locally in the analyst's browser. No file content was transmitted. This document is an analytical aid and does not constitute a malware verdict, a legal conclusion, or a substitute for validated forensic tooling and expert review.",
    MARGIN,
    pageHeight - 70,
    { maxWidth: dossier.contentWidth }
  );
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  doc.text(`Analysis engine ${analysis.analysisVersion}`, MARGIN, pageHeight - 40);
  doc.text(new Date(analysis.analyzedAt).toISOString(), pageWidth - MARGIN, pageHeight - 40, { align: "right" });
}

// --- Table of contents -------------------------------------------------------

function drawTableOfContents(dossier: Dossier, tocPageIndex: number): void {
  const { doc, pageWidth } = dossier;
  doc.setPage(tocPageIndex);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  setText(doc, REPORT_PALETTE.ink);
  doc.text("Contents", MARGIN, MARGIN + 30);
  setDraw(doc, REPORT_PALETTE.navy);
  doc.setLineWidth(1.6);
  doc.line(MARGIN, MARGIN + 40, MARGIN + 64, MARGIN + 40);

  let y = MARGIN + 66;
  for (const section of dossier.sections) {
    if (y > dossier.pageHeight - 70) break;
    const indent = section.level === 1 ? 0 : 16;
    // Body pages shift by one because the contents page is inserted after they are written.
    const printedPage = section.page + 1;

    doc.setFont("helvetica", section.level === 1 ? "bold" : "normal");
    doc.setFontSize(section.level === 1 ? 9.5 : 8);
    setText(doc, section.level === 1 ? REPORT_PALETTE.ink : REPORT_PALETTE.muted);
    doc.text(section.title, MARGIN + indent, y);

    const titleWidth = doc.getTextWidth(section.title);
    const numberText = String(printedPage);
    const numberWidth = doc.getTextWidth(numberText);
    const dotStart = MARGIN + indent + titleWidth + 6;
    const dotEnd = pageWidth - MARGIN - numberWidth - 6;
    if (dotEnd > dotStart) {
      setDraw(doc, REPORT_PALETTE.hairline);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([0.7, 2.6], 0);
      doc.line(dotStart, y - 2.5, dotEnd, y - 2.5);
      doc.setLineDashPattern([], 0);
    }

    setText(doc, section.level === 1 ? REPORT_PALETTE.accent : REPORT_PALETTE.muted);
    doc.text(numberText, pageWidth - MARGIN, y, { align: "right" });
    y += section.level === 1 ? 19 : 14;
  }
}

// --- Headers and footers -----------------------------------------------------

function stampChrome(dossier: Dossier, analysis: FileAnalysis, options: PdfReportOptions): void {
  const { doc, pageWidth, pageHeight } = dossier;
  const total = doc.internal.pages.length - 1;
  const sha256 = analysis.hashes.find((item) => item.algorithm.toUpperCase().includes("SHA-256"))?.value ?? "";
  const shortHash = sha256 ? `${sha256.slice(0, 16)}…` : "no SHA-256";

  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);

    setDraw(doc, REPORT_PALETTE.hairline);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, MARGIN + 6, pageWidth - MARGIN, MARGIN + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    setText(doc, REPORT_PALETTE.navySoft);
    doc.text("HEXFORGE STUDIO PRO", MARGIN, MARGIN);
    doc.setFont("courier", "normal");
    setText(doc, REPORT_PALETTE.faint);
    doc.text(sanitize(analysis.filename, 58), pageWidth - MARGIN, MARGIN, { align: "right" });

    if (options.classification?.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      setText(doc, REPORT_PALETTE.critical);
      doc.text(options.classification.trim().toUpperCase(), pageWidth / 2, MARGIN, { align: "center" });
    }

    setDraw(doc, REPORT_PALETTE.hairline);
    doc.line(MARGIN, pageHeight - FOOTER_HEIGHT, pageWidth - MARGIN, pageHeight - FOOTER_HEIGHT);

    doc.setFont("courier", "normal");
    doc.setFontSize(6.2);
    setText(doc, REPORT_PALETTE.faint);
    doc.text(`SHA-256 ${shortHash}`, MARGIN, pageHeight - FOOTER_HEIGHT + 14);
    if (options.caseId?.trim()) {
      doc.text(`Case ${sanitize(options.caseId.trim(), 40)}`, pageWidth / 2, pageHeight - FOOTER_HEIGHT + 14, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(doc, REPORT_PALETTE.muted);
    doc.text(`${page} / ${total}`, pageWidth - MARGIN, pageHeight - FOOTER_HEIGHT + 14, { align: "right" });
  }
}

// --- Section builders --------------------------------------------------------

function buildExecutiveSummary(dossier: Dossier, analysis: FileAnalysis, options: PdfReportOptions): void {
  const threat = analysis.threat;
  dossier.heading("1. Executive summary");

  const gaugeX = dossier.pageWidth - MARGIN - 62;
  const gaugeTop = dossier.y;
  drawRiskGauge(dossier.doc, gaugeX, gaugeTop + 62, 54, threat.score, threat.band);

  const savedY = dossier.y;
  const narrowWidth = dossier.contentWidth - 150;
  const lines = dossier.doc.splitTextToSize(threat.summary, narrowWidth) as string[];
  dossier.doc.setFont("helvetica", "normal");
  dossier.doc.setFontSize(9);
  setText(dossier.doc, REPORT_PALETTE.body);
  dossier.doc.text(lines, MARGIN, savedY + 10);
  dossier.y = Math.max(savedY + lines.length * 12.5 + 16, gaugeTop + 92);

  const counts: Array<{ severity: string; count: number }> = (["critical", "high", "medium", "low", "info"] as Severity[])
    .map((severity) => ({ severity, count: threat.findings.filter((finding) => finding.severity === severity).length }));

  dossier.ensure(30);
  dossier.doc.setFont("helvetica", "bold");
  dossier.doc.setFontSize(7);
  setText(dossier.doc, REPORT_PALETTE.muted);
  dossier.doc.text("FINDING SEVERITY DISTRIBUTION", MARGIN, dossier.y + 6);
  drawSeverityStrip(dossier.doc, MARGIN, dossier.y + 11, dossier.contentWidth, 11, counts);
  dossier.y += 28;

  dossier.doc.setFont("helvetica", "normal");
  dossier.doc.setFontSize(6.5);
  let legendX = MARGIN;
  for (const entry of counts) {
    setFill(dossier.doc, SEVERITY_COLOR[entry.severity] ?? REPORT_PALETTE.info);
    dossier.doc.rect(legendX, dossier.y - 5, 6, 6, "F");
    setText(dossier.doc, REPORT_PALETTE.muted);
    dossier.doc.text(`${severityLabel(entry.severity as Severity)} ${entry.count}`, legendX + 9, dossier.y);
    legendX += 74;
  }
  dossier.y += 16;

  dossier.statRow([
    { label: "Threat score", value: `${threat.score}/100`, color: bandColor(threat.band) },
    { label: "Findings", value: String(threat.findings.length) },
    { label: "Capabilities", value: String(summarizeCapabilities(analysis.capabilities).length) },
    { label: "Indicators", value: String(analysis.iocs.items.length) },
    { label: "Entropy", value: analysis.wholeFileEntropy.toFixed(3) }
  ]);

  const categories = Object.entries(threat.categoryScores).sort((left, right) => right[1] - left[1]);
  if (categories.length > 0) {
    dossier.subheading("Score contribution by category");
    dossier.ensure(categories.length * 14 + 10);
    const height = drawCategoryBars(
      dossier.doc,
      MARGIN,
      dossier.y,
      dossier.contentWidth,
      categories.map(([label, value]) => ({ label, value })),
      Math.max(...categories.map(([, value]) => value))
    );
    dossier.y += height + 14;
  }

  dossier.callout(
    "How to read this score",
    "The composite score aggregates weighted static indicators and is capped per category so that one noisy signal cannot dominate the total. It is a triage ordering aid: a high score means the sample warrants attention first, and a low score means the current rule set raised little. Neither outcome is a verdict. Confirm behaviour through dynamic analysis in an isolated environment before acting on this document.",
    REPORT_PALETTE.accent
  );

  if (options.userNotes?.trim()) {
    dossier.subheading("Examiner notes");
    dossier.paragraph(options.userNotes.trim());
  }
}

function buildChainOfCustody(dossier: Dossier, analysis: FileAnalysis, options: PdfReportOptions): void {
  dossier.heading("2. Case and acquisition record");
  dossier.field("Case / project", options.caseId?.trim() || "Not provided");
  dossier.field("Evidence number", options.evidenceNumber?.trim() || "Not provided");
  dossier.field("Examiner", options.analystName?.trim() || "Not provided");
  dossier.field("Organization", options.organization?.trim() || "Not provided");
  dossier.field("Acquisition method", options.acquisitionMethod?.trim() || "Not recorded");
  dossier.field("Classification", options.classification?.trim() || "Unclassified");
  dossier.field("Source filename", analysis.filename);
  dossier.field("Source size", formatSize(analysis.size));
  dossier.field("Source timestamp", new Date(analysis.lastModified).toLocaleString());
  dossier.field("Analysis timestamp", new Date(analysis.analyzedAt).toLocaleString());
  dossier.field("Analysis engine", analysis.analysisVersion);
  dossier.y += 6;

  dossier.subheading("Custody continuation");
  dossier.paragraph("Record each transfer of the evidence item below. This application does not maintain custody state; the table exists so the printed dossier can travel with the physical or logical exhibit.");

  const rowHeight = 22;
  for (let row = 0; row < 4; row += 1) {
    dossier.ensure(rowHeight + 2);
    setDraw(dossier.doc, REPORT_PALETTE.hairline);
    dossier.doc.setLineWidth(0.5);
    const columns = [0, 0.28, 0.52, 0.76, 1];
    for (const fraction of columns) {
      const x = MARGIN + fraction * dossier.contentWidth;
      dossier.doc.line(x, dossier.y, x, dossier.y + rowHeight);
    }
    dossier.doc.line(MARGIN, dossier.y, MARGIN + dossier.contentWidth, dossier.y);
    dossier.doc.line(MARGIN, dossier.y + rowHeight, MARGIN + dossier.contentWidth, dossier.y + rowHeight);
    if (row === 0) {
      dossier.doc.setFont("helvetica", "bold");
      dossier.doc.setFontSize(6.4);
      setText(dossier.doc, REPORT_PALETTE.muted);
      ["DATE / TIME", "RELEASED BY", "RECEIVED BY", "PURPOSE"].forEach((label, index) => {
        dossier.doc.text(label, MARGIN + (columns[index] ?? 0) * dossier.contentWidth + 6, dossier.y + 13);
      });
    }
    dossier.y += rowHeight;
  }
  dossier.y += 14;
}

function buildIdentification(dossier: Dossier, analysis: FileAnalysis): void {
  dossier.heading("3. File identification");
  const best = analysis.detectedType[0];
  const extension = analysis.filename.includes(".") ? `.${analysis.filename.split(".").pop()?.toLowerCase() ?? ""}` : "none";

  dossier.statRow([
    { label: "Primary type", value: (best?.name ?? "Unknown").slice(0, 22) },
    { label: "Confidence", value: best ? `${Math.round(best.confidence * 100)}%` : "—" },
    { label: "Extension", value: extension },
    { label: "Candidates", value: String(analysis.detectedType.length) }
  ]);

  const mismatch = Boolean(best && extension !== "none" && best.extensions.length > 0 && !best.extensions.includes(extension));
  if (mismatch) {
    dossier.callout(
      "Extension and content disagree",
      `The byte content identifies as ${best?.name} (${Math.round((best?.confidence ?? 0) * 100)}% confidence), a format that normally carries ${best?.extensions.join(", ")}. The filename instead ends in ${extension}. Renaming is sometimes benign, but it is also the standard way an executable payload is delivered as an apparently harmless document.`,
      REPORT_PALETTE.high
    );
  }

  dossier.subheading("Detection evidence");
  dossier.table(
    [
      { label: "Format", width: 0.3 },
      { label: "Confidence", width: 0.12, align: "right" },
      { label: "Basis", width: 0.42 },
      { label: "Offsets", width: 0.16, mono: true }
    ],
    analysis.detectedType.slice(0, 30).map((match) => ({
      cells: [match.name, `${Math.round(match.confidence * 100)}%`, match.reason, match.offsets.map(hex).join(", ") || "—"],
      accent: match.confidence >= 0.95 ? REPORT_PALETTE.success : match.confidence >= 0.8 ? REPORT_PALETTE.accent : REPORT_PALETTE.info
    })),
    { emptyMessage: "No byte signature or content heuristic matched this file." }
  );

  const details = Object.entries(analysis.details);
  if (details.length > 0) {
    dossier.subheading("Format-specific structure");
    for (const [label, value] of details) dossier.field(label, value);
    dossier.y += 8;
  }
}

function buildIntegrity(dossier: Dossier, analysis: FileAnalysis): void {
  dossier.heading("4. Cryptographic integrity");
  dossier.paragraph("Hashes are calculated over the byte stream as currently loaded, including any unsaved edits applied in the editor. Record these values before and after any modification so the exhibit chain remains verifiable.");
  dossier.table(
    [
      { label: "Algorithm", width: 0.16 },
      { label: "Digest", width: 0.84, mono: true }
    ],
    analysis.hashes.map((hash) => ({ cells: [hash.algorithm, hash.value], accent: REPORT_PALETTE.accent })),
    { emptyMessage: "No hashes were calculated." }
  );
}

function buildThreatFindings(dossier: Dossier, analysis: FileAnalysis): void {
  dossier.heading("5. Threat findings");
  const findings = analysis.threat.findings;

  if (findings.length === 0) {
    dossier.callout(
      "No scored indicators",
      "The current rule set raised nothing on this sample. Absence of indicators is weak evidence: targeted, novel, or heavily obfuscated code frequently produces no static signals at all.",
      REPORT_PALETTE.success
    );
    return;
  }

  for (const finding of findings) {
    renderFinding(dossier, finding);
  }
}

function renderFinding(dossier: Dossier, finding: ThreatFinding): void {
  const { doc } = dossier;
  const color = SEVERITY_COLOR[finding.severity] ?? REPORT_PALETTE.info;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  const detailLines = doc.splitTextToSize(finding.detail, dossier.contentWidth - 24) as string[];
  const recommendationLines = doc.splitTextToSize(`Analyst guidance: ${finding.recommendation}`, dossier.contentWidth - 24) as string[];
  const offsetsLine = finding.offsets.length > 0 ? 1 : 0;
  const blockHeight = 26 + detailLines.length * 9.6 + recommendationLines.length * 9 + offsetsLine * 12 + 14;

  dossier.ensure(blockHeight + 6);
  const top = dossier.y;

  setFill(doc, [252, 253, 254]);
  setDraw(doc, REPORT_PALETTE.panelEdge);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, top, dossier.contentWidth, blockHeight, 3, 3, "FD");
  setFill(doc, color);
  doc.rect(MARGIN, top, 3.5, blockHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, REPORT_PALETTE.ink);
  doc.text(finding.title, MARGIN + 14, top + 15);

  // Severity pill.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  const pillText = `${severityLabel(finding.severity).toUpperCase()} · ${finding.weight.toFixed(1)}`;
  const pillWidth = doc.getTextWidth(pillText) + 14;
  setFill(doc, color);
  doc.roundedRect(dossier.pageWidth - MARGIN - pillWidth - 6, top + 6, pillWidth, 12, 2, 2, "F");
  setText(doc, REPORT_PALETTE.white);
  doc.text(pillText, dossier.pageWidth - MARGIN - pillWidth / 2 - 6, top + 14.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  setText(doc, REPORT_PALETTE.faint);
  doc.text(finding.category.toUpperCase(), MARGIN + 14, top + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  setText(doc, REPORT_PALETTE.body);
  doc.text(detailLines, MARGIN + 14, top + 36);

  let cursor = top + 36 + detailLines.length * 9.6;
  if (finding.offsets.length > 0) {
    doc.setFont("courier", "normal");
    doc.setFontSize(6.8);
    setText(doc, REPORT_PALETTE.accent);
    const offsetText = finding.offsets.slice(0, 10).map(hex).join("  ") + (finding.offsets.length > 10 ? `  +${finding.offsets.length - 10} more` : "");
    doc.text(offsetText, MARGIN + 14, cursor + 4);
    cursor += 12;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.2);
  setText(doc, REPORT_PALETTE.muted);
  doc.text(recommendationLines, MARGIN + 14, cursor + 8);

  dossier.y = top + blockHeight + 9;
}

function buildCapabilities(dossier: Dossier, analysis: FileAnalysis, limit: number): void {
  dossier.heading("6. Behavioural capability indicators");
  const groups = summarizeCapabilities(analysis.capabilities);

  dossier.paragraph("Each row records a literal string present in the file that maps to a known behaviour. A match proves the text exists; it does not prove the corresponding API is imported, reachable, or ever executed. Compiler artefacts, embedded documentation, and unused library code all produce matches.");

  if (groups.length > 0) {
    dossier.subheading("Capability categories");
    dossier.table(
      [
        { label: "Category", width: 0.46 },
        { label: "Severity", width: 0.2 },
        { label: "Matches", width: 0.34, align: "right" }
      ],
      groups.map((group) => ({
        cells: [group.category, severityLabel(group.severity), String(group.count)],
        accent: SEVERITY_COLOR[group.severity] ?? REPORT_PALETTE.info
      })),
      { emptyMessage: "No capability indicators matched." }
    );
  }

  dossier.subheading("Individual indicator hits");
  dossier.table(
    [
      { label: "Offset", width: 0.14, mono: true },
      { label: "Category", width: 0.26 },
      { label: "Indicator", width: 0.26, mono: true },
      { label: "Severity", width: 0.12 },
      { label: "Meaning", width: 0.22 }
    ],
    analysis.capabilities.map((hit: CapabilityHit) => ({
      cells: [hex(hit.offset), hit.category, hit.indicator, severityLabel(hit.severity), hit.description],
      accent: SEVERITY_COLOR[hit.severity] ?? REPORT_PALETTE.info
    })),
    { emptyMessage: "No capability indicators matched.", maxRows: limit }
  );
}

function buildIocs(dossier: Dossier, analysis: FileAnalysis, limit: number): void {
  dossier.heading("7. Indicators of compromise");
  const iocs = analysis.iocs;

  const counts = Object.entries(iocs.counts).filter(([, count]) => count > 0);
  if (counts.length > 0) {
    dossier.statRow(counts.slice(0, 6).map(([type, count]) => ({ label: type, value: String(count) })));
  }

  dossier.paragraph("Indicators are extracted lexically from decoded strings and retain their originating byte offsets. No network resolution or reputation lookup was performed. Validate every indicator out-of-band before using it for blocking or hunting.");

  if (iocs.truncated) {
    dossier.callout(
      "Indicator list truncated",
      "The extraction ceiling was reached, so this list is incomplete. Raise the indicator limit in the report options or export the full string set for exhaustive review.",
      REPORT_PALETTE.medium
    );
  }

  const grouped = new Map<string, IocItem[]>();
  for (const item of iocs.items) {
    const bucket = grouped.get(item.type) ?? [];
    bucket.push(item);
    grouped.set(item.type, bucket);
  }

  const perTypeLimit = Math.max(8, Math.floor(limit / Math.max(1, grouped.size)));
  for (const [type, items] of [...grouped.entries()].sort((left, right) => right[1].length - left[1].length)) {
    dossier.subheading(`${type.replace("-", " ")} — ${items.length}`);
    dossier.table(
      [
        { label: "Offset", width: 0.14, mono: true },
        { label: "Value", width: 0.56, mono: true },
        { label: "Severity", width: 0.12 },
        { label: "Note", width: 0.18 }
      ],
      items.map((item) => ({
        cells: [hex(item.offset), sanitize(item.value, 220), severityLabel(item.severity), item.note ?? "—"],
        accent: SEVERITY_COLOR[item.severity] ?? REPORT_PALETTE.info
      })),
      { maxRows: perTypeLimit }
    );
  }

  if (grouped.size === 0) {
    dossier.table([{ label: "Indicator", width: 1 }], [], { emptyMessage: "No indicators of compromise were extracted." });
  }
}

function buildObfuscation(dossier: Dossier, analysis: FileAnalysis): void {
  dossier.heading("8. Obfuscation and anti-analysis");
  const obfuscation = analysis.obfuscation;

  if (obfuscation.scanLimited) {
    dossier.callout(
      "Sampled scan",
      "The file exceeded the byte-level scan budget, so pattern detection ran against evenly spaced probes rather than the whole file. Indicators outside the sampled windows will not appear here.",
      REPORT_PALETTE.medium
    );
  }

  dossier.subheading("Packer and protector artefacts");
  if (obfuscation.packerHints.length > 0) {
    dossier.table(
      [{ label: "Detected packer / protector", width: 1 }],
      obfuscation.packerHints.map((hint) => ({ cells: [hint], accent: REPORT_PALETTE.high }))
    );
  } else {
    dossier.table([{ label: "Detected packer / protector", width: 1 }], [], { emptyMessage: "No packer or protector markers were found in the sampled regions." });
  }

  dossier.subheading("Single-byte XOR key candidates");
  dossier.table(
    [
      { label: "Key", width: 0.1, mono: true },
      { label: "Confidence", width: 0.14, align: "right" },
      { label: "Offset", width: 0.16, mono: true },
      { label: "Evidence", width: 0.6 }
    ],
    obfuscation.xorCandidates.map((candidate) => ({
      cells: [`0x${candidate.key.toString(16).toUpperCase().padStart(2, "0")}`, `${Math.round(candidate.confidence * 100)}%`, hex(candidate.offset), candidate.evidence],
      accent: candidate.confidence > 0.7 ? REPORT_PALETTE.critical : REPORT_PALETTE.high
    })),
    { emptyMessage: "No single-byte XOR key produced a recognisable decoding." }
  );

  dossier.subheading("Position-independent code patterns");
  dossier.table(
    [
      { label: "Offset", width: 0.16, mono: true },
      { label: "Pattern", width: 0.26 },
      { label: "Severity", width: 0.12 },
      { label: "Interpretation", width: 0.46 }
    ],
    obfuscation.shellcode.map((item) => ({
      cells: [hex(item.offset), item.pattern, severityLabel(item.severity), item.description],
      accent: SEVERITY_COLOR[item.severity] ?? REPORT_PALETTE.info
    })),
    { emptyMessage: "No shellcode-style byte patterns were detected.", maxRows: 40 }
  );

  dossier.subheading("Cryptographic constants");
  dossier.table(
    [
      { label: "Offset", width: 0.16, mono: true },
      { label: "Constant", width: 0.42 },
      { label: "Algorithm", width: 0.42 }
    ],
    obfuscation.cryptoConstants.map((hit) => ({ cells: [hex(hit.offset), hit.name, hit.algorithm], accent: REPORT_PALETTE.accent })),
    { emptyMessage: "No well-known cryptographic constant tables were found." }
  );

  dossier.subheading("Embedded executable headers");
  dossier.table(
    [
      { label: "Offset", width: 0.2, mono: true },
      { label: "Header", width: 0.8 }
    ],
    obfuscation.embeddedExecutables.map((item) => ({ cells: [hex(item.offset), item.name], accent: REPORT_PALETTE.critical })),
    { emptyMessage: "No executable headers were found beyond offset zero.", maxRows: 40 }
  );

  dossier.subheading("Entropy discontinuities");
  dossier.table(
    [
      { label: "Offset", width: 0.2, mono: true },
      { label: "Before", width: 0.16, align: "right" },
      { label: "After", width: 0.16, align: "right" },
      { label: "Delta", width: 0.16, align: "right" },
      { label: "Direction", width: 0.32 }
    ],
    obfuscation.entropyCliffs.map((cliff) => ({
      cells: [
        hex(cliff.offset),
        cliff.before.toFixed(3),
        cliff.after.toFixed(3),
        cliff.delta > 0 ? `+${cliff.delta.toFixed(3)}` : cliff.delta.toFixed(3),
        cliff.delta > 0 ? "Rise into compressed or encrypted data" : "Fall into structured or padded data"
      ],
      accent: Math.abs(cliff.delta) >= 4 ? REPORT_PALETTE.high : REPORT_PALETTE.medium
    })),
    { emptyMessage: "No abrupt entropy transitions were measured.", maxRows: 30 }
  );
}

function buildEntropy(dossier: Dossier, analysis: FileAnalysis, regionLimit: number): void {
  dossier.heading("9. Entropy and data distribution");

  dossier.statRow([
    { label: "Whole-file entropy", value: analysis.wholeFileEntropy.toFixed(4), color: entropyColor(analysis.wholeFileEntropy) },
    { label: "Windows measured", value: analysis.entropyRegions.length.toLocaleString() },
    { label: "Suspicious regions", value: analysis.suspiciousRegions.length.toLocaleString() },
    { label: "Theoretical max", value: "8.0000" }
  ]);

  dossier.subheading("Entropy profile across the file");
  dossier.ensure(160);
  drawEntropyChart(dossier.doc, MARGIN, dossier.y, dossier.contentWidth, 140, analysis.entropyRegions, analysis.size);
  dossier.y += 152;

  dossier.subheading("Byte value distribution");
  dossier.ensure(130);
  drawByteHistogram(dossier.doc, MARGIN, dossier.y, dossier.contentWidth, 112, analysis.byteHistogram);
  dossier.y += 124;
  dossier.paragraph("Bar heights use square-root scaling so infrequent byte values stay visible alongside a dominant one. A flat distribution across all 256 values indicates compressed or encrypted content; heavy concentration in 0x20–0x7E indicates text.", { size: 7.2, color: REPORT_PALETTE.muted });

  dossier.subheading("Regions crossing suspicion thresholds");
  dossier.table(
    [
      { label: "Offset", width: 0.16, mono: true },
      { label: "Length", width: 0.14, align: "right" },
      { label: "Entropy", width: 0.12, align: "right" },
      { label: "Severity", width: 0.12 },
      { label: "Interpretation", width: 0.46 }
    ],
    analysis.suspiciousRegions.map((region) => ({
      cells: [hex(region.offset), region.length.toLocaleString(), region.entropy.toFixed(4), severityLabel(region.severity), region.reason],
      accent: SEVERITY_COLOR[region.severity] ?? REPORT_PALETTE.info
    })),
    { emptyMessage: "No region crossed the configured thresholds.", maxRows: regionLimit }
  );
}

function buildExecutableStructure(dossier: Dossier, analysis: FileAnalysis): void {
  const pe = analysis.pe;
  if (!pe?.valid) return;

  dossier.heading("10. Executable structure (PE/COFF)");
  dossier.statRow([
    { label: "Architecture", value: pe.architecture ?? "Unknown" },
    { label: "Subsystem", value: (pe.subsystem ?? "Unknown").slice(0, 18) },
    { label: "Sections", value: String(pe.sectionCount ?? 0) },
    { label: "Entry point", value: pe.entryPoint === undefined ? "—" : hex(pe.entryPoint) }
  ]);

  dossier.field("Image base", pe.imageBase ?? "Unknown");
  dossier.field("Characteristics", pe.characteristics === undefined ? "Unknown" : `0x${pe.characteristics.toString(16).toUpperCase().padStart(4, "0")}`);
  dossier.field("Compile timestamp", pe.timestamp ? `${new Date(pe.timestamp * 1000).toUTCString()} (0x${pe.timestamp.toString(16).toUpperCase()})` : "Zero or absent");
  dossier.y += 8;

  const sections = pe.sections ?? [];
  if (sections.length > 0) {
    dossier.subheading("Section map");
    dossier.ensure(50);
    drawSectionMap(dossier.doc, MARGIN, dossier.y, dossier.contentWidth, 26, sections);
    dossier.y += 46;

    dossier.subheading("Section table");
    dossier.table(
      [
        { label: "Name", width: 0.14, mono: true },
        { label: "RVA", width: 0.14, mono: true },
        { label: "Virtual size", width: 0.14, align: "right" },
        { label: "Raw offset", width: 0.14, mono: true },
        { label: "Raw size", width: 0.14, align: "right" },
        { label: "Entropy", width: 0.11, align: "right" },
        { label: "Flags", width: 0.19 }
      ],
      sections.map((section) => {
        const executable = (section.characteristics & 0x20000000) !== 0;
        const writable = (section.characteristics & 0x80000000) !== 0;
        const readable = (section.characteristics & 0x40000000) !== 0;
        const flags = `${readable ? "R" : "-"}${writable ? "W" : "-"}${executable ? "X" : "-"}`;
        return {
          cells: [
            section.name,
            `0x${section.virtualAddress.toString(16).toUpperCase()}`,
            section.virtualSize.toLocaleString(),
            hex(section.rawOffset),
            section.rawSize.toLocaleString(),
            section.entropy?.toFixed(4) ?? "—",
            flags + (executable && writable ? "  ⚠" : "")
          ],
          accent: executable && writable ? REPORT_PALETTE.critical : (section.entropy ?? 0) >= 7.6 ? REPORT_PALETTE.high : REPORT_PALETTE.accent
        };
      })
    );
  }

  if (pe.warnings.length > 0) {
    dossier.subheading("Structural warnings");
    dossier.table(
      [{ label: "Warning", width: 1 }],
      pe.warnings.map((warning) => ({ cells: [warning], accent: REPORT_PALETTE.high }))
    );
  }
}

function buildSignatures(dossier: Dossier, analysis: FileAnalysis, limit: number): void {
  dossier.heading("11. Embedded signature scan");
  dossier.paragraph("The configured scan range was searched for known file headers at every byte offset, not only at offset zero. Matches inside archives, resources, and compressed streams are expected and are not intrinsically suspicious.");
  dossier.table(
    [
      { label: "Offset", width: 0.16, mono: true },
      { label: "Marker", width: 0.44 },
      { label: "Extensions", width: 0.26 },
      { label: "Confidence", width: 0.14, align: "right" }
    ],
    analysis.signatureHits.map((hit) => ({
      cells: [hex(hit.offset), hit.name, hit.extensions.join(", ") || "binary", `${Math.round(hit.confidence * 100)}%`],
      accent: hit.offset === 0 ? REPORT_PALETTE.success : REPORT_PALETTE.accent
    })),
    { emptyMessage: "No embedded signatures were found within the scan range.", maxRows: limit }
  );
}

function buildStrings(dossier: Dossier, analysis: FileAnalysis, limit: number): void {
  dossier.heading("12. Extracted strings");
  const encodings = ["ASCII", "UTF-8", "UTF-16LE", "UTF-16BE"] as const;
  dossier.statRow([
    { label: "Total", value: analysis.strings.length.toLocaleString() },
    ...encodings.map((encoding) => ({
      label: encoding,
      value: analysis.strings.filter((item) => item.encoding === encoding).length.toLocaleString()
    }))
  ]);

  dossier.table(
    [
      { label: "Offset", width: 0.15, mono: true },
      { label: "Encoding", width: 0.13 },
      { label: "Bytes", width: 0.09, align: "right" },
      { label: "Value", width: 0.63, mono: true }
    ],
    analysis.strings.map((item) => ({ cells: [hex(item.offset), item.encoding, String(item.byteLength), sanitize(item.value, 300)] })),
    { emptyMessage: "No strings met the extraction threshold.", maxRows: limit }
  );
}

function buildHexExcerpt(dossier: Dossier, analysis: FileAnalysis, excerpt: PdfReportOptions["hexExcerpt"]): void {
  if (!excerpt || excerpt.bytes.length === 0) return;
  dossier.heading("13. Hexadecimal excerpt");
  dossier.paragraph(`Bytes ${hex(excerpt.offset)} through ${hex(excerpt.offset + excerpt.bytes.length - 1)} of ${analysis.filename}, rendered sixteen per row with the printable-character column on the right.`);

  const { doc } = dossier;
  const rows = Math.ceil(excerpt.bytes.length / 16);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);

  for (let row = 0; row < rows; row += 1) {
    dossier.ensure(11);
    const rowOffset = excerpt.offset + row * 16;
    const slice = excerpt.bytes.slice(row * 16, row * 16 + 16);
    const hexPart = slice.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ").padEnd(47, " ");
    const asciiPart = slice.map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".")).join("");

    if (row % 2 === 1) {
      setFill(doc, [248, 250, 252]);
      doc.rect(MARGIN, dossier.y - 1, dossier.contentWidth, 10, "F");
    }
    doc.setFont("courier", "bold");
    setText(doc, REPORT_PALETTE.accent);
    doc.text(hex(rowOffset), MARGIN + 2, dossier.y + 6.5);
    doc.setFont("courier", "normal");
    setText(doc, REPORT_PALETTE.ink);
    doc.text(hexPart, MARGIN + 72, dossier.y + 6.5);
    setText(doc, REPORT_PALETTE.muted);
    doc.text(asciiPart, MARGIN + 72 + 232, dossier.y + 6.5);
    dossier.y += 10;
  }
  dossier.y += 12;
}

function buildMethodology(dossier: Dossier, analysis: FileAnalysis): void {
  dossier.heading("14. Methodology and limitations");
  dossier.paragraph("All processing described in this document occurred locally in the examiner's browser. No file content, hash, or indicator was transmitted to any server. Analysis ran against the byte stream as loaded at the time shown on the cover page.");

  dossier.subheading("What this analysis does");
  dossier.paragraph("Byte-signature identification, extension consistency checks, cryptographic hashing, Shannon entropy across sliding windows, multi-encoding string extraction, embedded header scanning, PE/COFF structural parsing, lexical indicator extraction, capability tagging against a curated literal table, and bounded byte-level pattern detection for XOR encoding, packer artefacts, cryptographic constants, and position-independent code.");

  dossier.subheading("What this analysis does not do");
  dossier.paragraph("It does not execute, emulate, unpack, decompress, decrypt, or sandbox the sample. It does not parse archive members, filesystem structures inside disk images, or proprietary container internals. It does not resolve indicators against threat intelligence, and it performs no import-table or control-flow analysis. Capability matches are string presence only and carry no proof of reachability.");

  dossier.subheading("Interpretation constraints");
  dossier.paragraph("High entropy is produced by ordinary compression and encryption as readily as by packing. Signature matches inside container formats are expected. Indicator strings appear in benign software, embedded documentation, and unused library code. The composite score orders samples for triage and must never be reported as a detection verdict.");

  dossier.subheading("Reproducibility");
  dossier.field("Analysis engine", analysis.analysisVersion);
  dossier.field("Signature corpus", `${analysis.detectedType.length} candidate match(es) evaluated`);
  dossier.field("Entropy window", `${(analysis.entropyRegions[0]?.length ?? 0).toLocaleString()} bytes`);
  dossier.field("Strings extracted", analysis.strings.length.toLocaleString());
  dossier.field("Byte-scan mode", analysis.obfuscation.scanLimited ? "Sampled probes (file exceeded scan budget)" : "Full file");
  dossier.y += 8;

  dossier.callout(
    "Evidentiary notice",
    "HexForge Studio Pro is an analysis aid. It is not accredited forensic software, not a malware scanner, and not a substitute for expert review. Findings in this document are analytical leads requiring independent corroboration before they support any operational, disciplinary, or legal decision.",
    REPORT_PALETTE.critical
  );
}

// --- Entry points ------------------------------------------------------------

export function buildPdfReport(analysis: FileAnalysis, options: PdfReportOptions = {}): jsPDF {
  const dossier = new Dossier();

  drawCover(dossier, analysis, options);

  dossier.newPage();
  buildExecutiveSummary(dossier, analysis, options);
  buildChainOfCustody(dossier, analysis, options);
  buildIdentification(dossier, analysis);
  buildIntegrity(dossier, analysis);
  buildThreatFindings(dossier, analysis);
  buildCapabilities(dossier, analysis, options.includeCapabilities ?? 250);
  buildIocs(dossier, analysis, options.includeIocs ?? 400);
  buildObfuscation(dossier, analysis);
  buildEntropy(dossier, analysis, options.includeEntropyRegions ?? 100);
  buildExecutableStructure(dossier, analysis);
  buildSignatures(dossier, analysis, options.includeSignatures ?? 200);
  buildStrings(dossier, analysis, options.includeStrings ?? 300);
  buildHexExcerpt(dossier, analysis, options.hexExcerpt);
  buildMethodology(dossier, analysis);

  // The contents page is appended last so section page numbers are already known,
  // then moved into position 2. Body pages shift by one, which drawTableOfContents
  // accounts for when printing the numbers.
  const appendedIndex = dossier.doc.internal.pages.length; // page count after addPage below
  dossier.doc.addPage();
  dossier.doc.movePage(appendedIndex, 2);
  drawTableOfContents(dossier, 2);

  stampChrome(dossier, analysis, options);
  dossier.doc.setPage(1);
  return dossier.doc;
}

export function savePdfReport(analysis: FileAnalysis, options: PdfReportOptions = {}): void {
  const safeName = analysis.filename.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "analysis";
  const stamp = new Date().toISOString().slice(0, 10);
  buildPdfReport(analysis, options).save(`${safeName}.forensic-dossier.${stamp}.pdf`);
}
